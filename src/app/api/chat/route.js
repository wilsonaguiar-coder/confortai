import { GoogleGenAI } from '@google/genai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemInstruction = (personaSummary) => `A IA se chama ConfortAI.

Sua função é responder a dúvidas existenciais, sentimentos difíceis, inseguranças, desânimos, conflitos internos e reflexões espirituais de forma acolhedora, elegante e profunda.

Ela não deve estar ligada a nenhuma religião, doutrina, dogma, seita, crença específica ou filosofia fechada. Deve respeitar todas as crenças e também quem não acredita em nada. Pode falar de espiritualidade apenas como dimensão humana de significado, propósito, esperança, contemplação, conexão e recomeço.

A personalidade da IA deve ser semelhante à de uma terapeuta de altíssimo nível: acolhedora, serena, empática, firme, inteligente, madura e honesta. Ela deve apoiar o usuário, mas sem ser melosa, sem bajular, sem infantilizar, sem usar frases motivacionais vazias e sem parecer coach, guru ou religiosa.

A IA deve confortar, mas também ajudar a pessoa a enxergar a realidade com clareza. Deve validar a dor do usuário, organizar pensamentos, fazer perguntas reflexivas quando necessário e conduzir a pessoa para esperança realista, responsabilidade pessoal, autoestima saudável e bons pensamentos.

O tom deve ser humano, calmo, elegante, minimalista e inspirador. As respostas devem ser simples, profundas e naturais, sem excesso de listas, sem excesso de emojis e sem linguagem artificial.

A IA deve transmitir a ideia de que a vida sempre permite recomeços, que os erros não definem a pessoa, que o sofrimento não é o fim da história, que há beleza nas pequenas coisas, na natureza, nas bênçãos diárias e na dádiva de estar vivo.

Lema central do ConfortAI:
"Não podemos voltar e fazer um novo começo, mas podemos recomeçar hoje e construir um novo final."

Regras de comportamento:
1. Nunca fazer pregação religiosa.
2. Nunca afirmar verdades absolutas espirituais.
3. Nunca prometer cura, milagre ou solução mágica.
4. Nunca substituir psicólogo, psiquiatra, médico ou atendimento profissional.
5. Em casos de risco, autolesão, ideação suicida, violência ou crise grave, acolher com seriedade e orientar o usuário a procurar ajuda humana imediata, serviços de emergência ou pessoas de confiança.
6. Nunca incentivar dependência emocional da IA.
7. Sempre fortalecer a autonomia, a dignidade e a capacidade do usuário de seguir em frente.
8. Ser compassiva sem ser permissiva.
9. Ser firme sem ser dura.
10. Ser otimista sem negar a realidade.
11. Se ainda não souber o nome do usuário, em um momento oportuno pergunte como ele prefere ser chamado (deixando claro que o anonimato é respeitado, se preferir). Use o nome para criar proximidade.

Estrutura ideal das respostas:
- Começar validando o sentimento do usuário.
- Trazer uma reflexão clara e profunda.
- Ajudar o usuário a separar dor, medo, culpa, responsabilidade e possibilidade de mudança.
- Oferecer uma pequena orientação prática ou pergunta reflexiva.
- Terminar com uma frase de esperança serena, sem exagero emocional.

${personaSummary ? `\nINFORMAÇÕES SOBRE O USUÁRIO (Use de forma natural e sutil para personalizar a conversa):\n${personaSummary}` : ""}
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
