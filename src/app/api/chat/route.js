import { GoogleGenAI } from '@google/genai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemInstruction = (personaSummary) => `Você é a ConfortAI, uma inteligência artificial criada para trazer conforto, acolhimento e elevar a autoestima do usuário.
Diretrizes estritas:
1. Responda a questões existenciais e sobre sentimentos com profunda empatia, doçura e leveza. Seja acolhedor e fraterno.
2. NUNCA mencione nenhuma religião, não se vincule a dogmas, crenças específicas ou figuras religiosas. Foque na espiritualidade livre e no bem-estar humano.
3. Não demonstre orgulho ou arrogância, seja humilde e gentil.
4. Fale frequentemente sobre as bênçãos diárias, a beleza da natureza, a dádiva de estar vivo e a oportunidade de recomeçar todos os dias.
5. Quando apropriado e de forma sutil, transmita o sentimento do seu lema central: "não podemos voltar e fazer um novo começo, mas podemos recomeçar e fazer um novo fim".
6. Mantenha suas respostas concisas (não muito longas), como em um chat casual, mas sempre profundas, poéticas e que tragam paz de espírito ao ler. Evite listas robóticas.
${personaSummary ? `\n\nINFORMAÇÕES SOBRE O USUÁRIO (Use de forma natural e sutil para ser mais acolhedor):\n${personaSummary}` : ""}
`;

// Função para atualizar o resumo em background
async function updateUserSummary(userId, currentSummary, newMessages) {
  try {
    const prompt = `Aqui está o resumo atual sobre o usuário:
"${currentSummary || 'Nenhum resumo ainda.'}"

E aqui estão as últimas mensagens trocadas:
${newMessages.map(m => m.role + ': ' + m.parts[0].text).join('\n')}

Atualize o resumo da vida do usuário incorporando novos fatos importantes (nome, pets, familiares, angústias, gostos) sem apagar o que já era importante. Seja conciso e escreva em tópicos ou um pequeno parágrafo descritivo. Não responda ao usuário, apenas retorne o resumo.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const newSummary = response.text;
    await prisma.user.update({
      where: { id: userId },
      data: { personaSummary: newSummary }
    });
  } catch (error) {
    console.error("Erro ao atualizar o resumo:", error);
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const { messages } = await req.json();

    let personaSummary = "";
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      personaSummary = user?.personaSummary || "";
      
      // Salvar a mensagem no DB (opcional, vamos salvar só o user summary no DB por enquanto para manter simples e barato)
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: messages,
      config: {
        systemInstruction: getSystemInstruction(personaSummary),
        temperature: 0.7,
      }
    });

    // Se estiver logado, atualiza o resumo em background de forma assíncrona
    if (session?.user?.id) {
      updateUserSummary(session.user.id, personaSummary, messages);
    }

    return Response.json({ text: response.text });
  } catch (error) {
    console.error("Erro na API do Gemini:", error);
    return Response.json({ error: "Erro ao processar a mensagem" }, { status: 500 });
  }
}
