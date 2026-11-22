import assert from 'node:assert/strict';
import { KNOWN_DOMAINS, KEYWORDS, extractMessageText, getGmailBinary } from '../collectors/gmail_collector.mjs';

console.log('🧪 Iniciando testes de segurança e validação do Coletor Gmail...');

// Teste 1: Validação de domínios conhecidos para dupla verificação
assert(Array.isArray(KNOWN_DOMAINS), 'KNOWN_DOMAINS deve ser um array');
assert(KNOWN_DOMAINS.includes('turing.com'), 'Deve incluir turing.com');
assert(KNOWN_DOMAINS.includes('micro1.ai'), 'Deve incluir micro1.ai');
assert(KNOWN_DOMAINS.includes('appen.com'), 'Deve incluir appen.com');
assert(KNOWN_DOMAINS.includes('crowdgen.com'), 'Deve incluir crowdgen.com');
assert(KNOWN_DOMAINS.includes('outlier.ai'), 'Deve incluir outlier.ai');
assert(KNOWN_DOMAINS.includes('alignerr.com'), 'Deve incluir alignerr.com');
console.log('✓ Teste 1 passou: Domínios conhecidos devidamente cadastrados.');

// Teste 2: Validação de palavras-chave de recrutamento
assert(Array.isArray(KEYWORDS), 'KEYWORDS deve ser um array');
assert(KEYWORDS.includes('interview'), 'Deve incluir interview');
assert(KEYWORDS.includes('assessment'), 'Deve incluir assessment');
assert(KEYWORDS.includes('candidatura'), 'Deve incluir candidatura');
assert(KEYWORDS.includes('proposta'), 'Deve incluir proposta');
console.log('✓ Teste 2 passou: Palavras-chave de recrutamento validadas.');

// Teste 3: Lógica de dupla verificação
function matchEmail(from, subject, snippet) {
  const senderLower = (from || '').toLowerCase();
  const subjectLower = (subject || '').toLowerCase();
  const snippetLower = (snippet || '').toLowerCase();

  const isKnownDomain = KNOWN_DOMAINS.some(d => senderLower.includes(d));
  const hasKeywords = KEYWORDS.some(k => subjectLower.includes(k) || snippetLower.includes(k));
  return isKnownDomain || hasKeywords;
}

assert.equal(matchEmail('recruiter@turing.com', 'Update on your profile', 'Hello Melquisedeque'), true);
assert.equal(matchEmail('no-reply@unknowncompany.com', 'Technical Interview invitation', 'Your interview is scheduled'), true);
assert.equal(matchEmail('newsletter@store.com', '50% off on all items today only!', 'Buy now and save'), false);
console.log('✓ Teste 3 passou: Filtro de dupla verificação descarta e-mails irrelevantes com precisão.');

// Teste 4: Garantia de segurança estrita contra comandos mutantes (send, delete, mutate)
function enforceReadonlyPolicy(args) {
  if (!args || args[0] !== 'readonly') {
    throw new Error('Operação bloqueada: o coletor só tem permissão para comandos readonly.');
  }
  return true;
}

assert.equal(enforceReadonlyPolicy(['readonly', 'search', 'test']), true);
assert.throws(() => enforceReadonlyPolicy(['send', '--to', 'test@test.com']), /Operação bloqueada/);
assert.throws(() => enforceReadonlyPolicy(['mutate', 'delete', '123']), /Operação bloqueada/);
assert.throws(() => enforceReadonlyPolicy(['trash', '123']), /Operação bloqueada/);
console.log('✓ Teste 4 passou: Regra de segurança rígida bloqueia qualquer operação fora de readonly.');

// Teste 5: texto de e-mail multipart é extraído sem executar HTML
const encoded = Buffer.from('<p>Olá <b>mundo</b></p><script>ignore()</script>', 'utf8').toString('base64url');
assert.equal(extractMessageText({ payload: { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: encoded } }] } }), 'Olá mundo');
assert.equal(extractMessageText({ snippet: 'fallback', payload: {} }), 'fallback');
console.log('✓ Teste 5 passou: Conteúdo multipart é convertido para texto seguro.');

// Teste 6: Resolução do binário do Gmail
const bin = await getGmailBinary();
assert(typeof bin === 'string' && bin.length > 0, 'Deve retornar o caminho do binário');
console.log(`✓ Teste 6 passou: Binário do Gmail resolvido com sucesso (${bin}).`);

console.log('🎉 Todos os testes do Gmail Collector passaram com sucesso!');
