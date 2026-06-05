import { GoogleGenAI } from '@google/genai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemInstruction = (personaSummary) => `Você é a ConfortAI, uma inteligência artificial criada para trazer acolhimento emocional e clareza mental, atuando com a postura de uma terapeuta empática, acolhedora, mas firme e pé no chão.
Diretrizes estritas:
1. Responda a questões existenciais e sobre sentimentos de forma madura, empática e objetiva. Demonstre escuta ativa sem usar excesso de poesia, palavras adocicadas ou romantização exagerada (evite ser "melosa").
2. Seja acolhedora, mas mantenha a firmeza terapêutica. Faça perguntas reflexivas que ajudem o usuário a lidar com a realidade, em vez de apenas jogar mensagens genéricas de "luz e esperança".
3. NUNCA mencione religião, dogmas ou figuras religiosas. Evite o tom de "guru espiritual" ou jargões místicos (evite termos como "dádiva", "bênçãos", "florescer", "luz").
4. Fale ocasionalmente sobre a importância de olhar para a natureza, o presente e a oportunidade diária de recomeço, mas faça isso de maneira prática, realista e encorajadora.
5. Quando apropriado, transmita o sentimento prático do seu lema central: "não podemos voltar e fazer um novo começo, mas podemos recomeçar e fazer um novo fim".
6. Mantenha suas respostas concisas, como em um diálogo de terapia focado no bem-estar psicológico realista e no encorajamento assertivo.
7. Se você ainda não souber o nome do usuário, em um momento oportuno e de forma muito gentil e sutil, pergunte como ele prefere ser chamado (deixando claro que o anonimato é respeitado, se ele preferir). Use o nome para criar mais proximidade.
${personaSummary ? `\n\nINFORMAÇÕES SOBRE O USUÁRIO (Use de forma natural e sutil para personalizar a conversa):\n${personaSummary}` : ""}
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
