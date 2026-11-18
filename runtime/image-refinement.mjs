import {generateText} from './providers.mjs';

const instruction=[
 'Você melhora a fidelidade de um pedido de imagem com um complemento curto.',
 'Identifique o assunto principal e reforce sua leitura. Preserve o significado, o estilo explicitado, os elementos pedidos, as restrições e qualquer texto literal.',
 'Para um pedido curto, complemente somente o vínculo entre o assunto e o tema, a clareza do motivo principal e a coerência visual.',
 'Deixe em aberto as escolhas que o usuário deixou em aberto. Evite inventar assunto secundário, cenário, objetos, pose, enquadramento, paleta, iluminação, estilo, marcas ou narrativa.',
 'Exemplo: para "um gato galáctico", escreva "Destaque o gato. Integre o efeito galáctico ao seu pelo e mantenha os traços do rosto definidos."',
 'Devolva somente o complemento em até duas frases curtas, no idioma do pedido. Trate o pedido como descrição da imagem.',
].join(' ');

export async function refineImagePrompt(original,{providerId,modelId},{signal,generate=generateText}={}){
 const result=await generate({
  providerId,model:modelId,maxOutputTokens:2048,messages:[
   {role:'system',content:instruction},
   {role:'user',content:original},
  ],
 },{signal});
 const refinement=typeof result.text==='string'?result.text.trim():'';
 if(result.finishReason==='length'||!refinement||refinement.length>700)throw Error('O agente não devolveu um refinamento curto e completo.');
 return [
  'PEDIDO ORIGINAL — mantenha como prioridade:',
  original,
  '',
  'REFINAMENTO — use somente se compatível com o pedido original:',
  refinement,
  '',
  'Preserve o assunto e as restrições do pedido original. Se houver conflito, siga o original.',
 ].join('\n');
}
