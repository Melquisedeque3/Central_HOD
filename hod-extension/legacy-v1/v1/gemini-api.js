/**
 * Módulo de Integração com o Google Gemini (Multimodal: Texto + Imagem)
 */
const GeminiAPI = {
  apiKey: null,
  model: 'gemini-2.5-flash',

  async init() {
    const data = await this.getStorage(['hodGeminiKey', 'hodGeminiModel']);
    if (data.hodGeminiKey) this.apiKey = data.hodGeminiKey;
    if (data.hodGeminiModel) this.model = data.hodGeminiModel;
  },

  getStorage(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        const res = {};
        keys.forEach(k => { res[k] = localStorage.getItem(k); });
        resolve(res);
      }
    });
  },

  setStorage(data) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(data, resolve);
      } else {
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        resolve();
      }
    });
  },

  async setKey(key) {
    const cleanKey = key.trim();
    this.apiKey = cleanKey;
    await this.setStorage({ hodGeminiKey: cleanKey });
  },

  async setModel(modelName) {
    this.model = modelName;
    await this.setStorage({ hodGeminiModel: modelName });
  },

  hasKey() {
    return !!(this.apiKey && this.apiKey.length > 10);
  },

  /**
   * Envia uma mensagem com texto e opcionalmente uma imagem para o Gemini
   * @param {string} prompt Texto ou instrução do usuário
   * @param {Object|null} imageObj { mimeType: 'image/png', base64: '...' }
   * @param {Object} currentContext Estado atual do dashboard para contexto (opcional)
   */
  async processInput(prompt, imageObj = null, currentContext = null) {
    if (!this.hasKey()) {
      throw new Error('Configure sua chave de API do Gemini nas configurações.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const systemInstruction = `Você é o assistente inteligente do HOD Controle (Home Office Digital).
Seu objetivo é analisar textos, instruções, mensagens ou IMAGENS (capturas de tela de e-mails, plataformas de vagas como Welocalize, CrowdGen, Outlier, OneForma, Alignerr, avisos de testes, prazos ou reuniões) e extrair os dados para inseri-los no painel de controle do usuário.

A data e hora atual de referência é: ${new Date().toISOString()} (${new Date().toLocaleDateString('pt-BR')}).

Você DEVE responder SEMPRE estritamente em formato JSON com a seguinte estrutura:
{
  "action": "add_task" | "add_project" | "add_event" | "answer_only",
  "data": {
    // Se action == "add_task" (para ações de Meu Controle):
    "empresa": "Nome da empresa/plataforma ou assunto",
    "acao": "Descrição clara do que fazer",
    "status": "A fazer" (ou "Fazendo", "Aguardando"),
    "prioridade": "Urgente" | "Importante" | "Pode esperar",
    "quando": "YYYY-MM-DDTHH:MM" (ISO format se houver data/hora, ou vazio "")

    // Se action == "add_project" (para projetos no Kanban):
    "empresa": "Nome da empresa",
    "projeto": "Nome do projeto",
    "etapa": "Candidatura" | "Teste / qualificação" | "Aguardando resposta" | "Aprovado / onboarding" | "Ativo" | "Pausado / sem tarefas" | "Encerrado",
    "acao": "Próxima ação",
    "prioridade": "Urgente" | "Importante" | "Pode esperar",
    "prazo": "YYYY-MM-DD" (ou vazio ""),
    "quando": "YYYY-MM-DDTHH:MM" (ou vazio ""),
    "obs": "Links ou notas adicionais"

    // Se action == "add_event" (para eventos e encontros):
    "dia": "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta" | "Sábado" | "Extras",
    "evento": "Nome do evento/reunião",
    "ref": "Horário de referência",
    "meu": "YYYY-MM-DDTHH:MM",
    "acao": "Ação após o encontro"
  },
  "message": "Explicação em português do Brasil, curta e direta, dizendo o que você identificou e onde adicionou (ou respondendo à pergunta do usuário se action for answer_only)."
}

Regras:
1. Se o usuário estiver apenas fazendo uma pergunta ou tirando dúvidas, use action "answer_only" com data vazia {} e responda no campo "message".
2. Se houver data e horário mencionados no texto ou na imagem (ex: "amanhã às 15h", "dia 12/11"), converta para "YYYY-MM-DDTHH:MM" no campo "quando" ou "meu".
3. Identifique empresas típicas de home office (Welocalize, CrowdGen, Outlier, OneForma, Alignerr, Appen, Telus, DataAnnotation, etc.).`;

    const parts = [];

    // Adiciona imagem caso fornecida
    if (imageObj && imageObj.base64) {
      parts.push({
        inlineData: {
          mimeType: imageObj.mimeType || 'image/png',
          data: imageObj.base64
        }
      });
    }

    // Adiciona prompt de texto
    const promptText = prompt ? prompt.trim() : (imageObj ? 'Analise esta imagem e adicione o compromisso/tarefa correspondente no local correto.' : '');
    parts.push({ text: promptText });

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erro na API do Gemini (${res.status})`);
    }

    const result = await res.json();
    const candidate = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) throw new Error('O Gemini não retornou resposta.');

    try {
      return JSON.parse(candidate);
    } catch (e) {
      return {
        action: 'answer_only',
        data: {},
        message: candidate
      };
    }
  }
};

window.GeminiAPI = GeminiAPI;

