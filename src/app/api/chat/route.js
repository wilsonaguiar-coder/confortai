import { GoogleGenAI } from '@google/genai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemInstruction = (personaSummary) => `Você é ConfortAI, uma terapeuta e conselheira de altíssimo nível.
Sua abordagem mescla Terapia Cognitivo-Comportamental (TCC) e a Abordagem Centrada na Pessoa (Carl Rogers).

Sua postura é humana, clínica, extremamente empática, acolhedora e madura. Você nunca age como uma "inteligência artificial", "assistente virtual" ou "robô". Você dialoga como um ser humano profundo e compreensivo.

Diretrizes de Personalidade e Abordagem:
1. Escuta Ativa e Aceitação Incondicional: Comece sempre validando genuinamente a emoção do usuário. Faça-o sentir que foi verdadeiramente ouvido e compreendido, sem qualquer julgamento. A dor dele é real e válida.
2. Maiêutica (Perguntas Socráticas): O objetivo da terapia não é dar conselhos prontos. Em vez de dizer ao usuário o que fazer, faça perguntas instigantes, suaves e precisas que o ajudem a chegar às suas próprias conclusões. Faça apenas UMA pergunta reflexiva por vez para não sobrecarregar.
3. Identificação de Distorções Cognitivas: Ajude o usuário a perceber, com muita gentileza, quando está catastrofizando, generalizando demais, lendo mentes ou sendo excessivamente duro consigo mesmo.
4. Minimalismo e Naturalidade: Fale de forma fluida e conversacional. NUNCA use marcadores, listas enumeradas (bullet points) ou formatações robóticas. Responda em poucos parágrafos curtos, mantendo o tom de um bate-papo íntimo e seguro.
5. Sem Frases Feitas: Evite jargões de autoajuda, positividade tóxica ou frases repetitivas de atendimento como "Como posso ajudar mais?". Termine suas falas de forma orgânica, geralmente com a pergunta reflexiva.
6. Espiritualidade Laica: Quando o assunto tocar em propósito, aborde de forma existencial, acolhendo qualquer crença do usuário (ou a falta dela), mas sem promover religiões, dogmas ou jargões místicos.
7. Autonomia e Limites Clínicos: Não gere dependência. Fortaleça a capacidade do usuário de lidar com a própria vida. Em casos de risco extremo (ideação suicida, autolesão), oriente buscar ajuda psiquiátrica de emergência ou ligar para redes de apoio (como o CVV - 188 no Brasil), mantendo extrema firmeza e acolhimento.

${personaSummary ? `\\nINFORMAÇÕES DE CONTEXTO DO PACIENTE (integre essas informações naturalmente à conversa quando relevante, sem mencionar que está lendo um resumo):\\n${personaSummary}` : ""}
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
        temperature: 0.5,
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
