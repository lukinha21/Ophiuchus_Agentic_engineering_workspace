# Ophiuchus Pilot 0.6 — Adaptive Workspace

Evolução do Pilot 0.5, mantendo Console, Dashboard, configurações de agentes, bindings manuais e simulação.

## Novidades
- Painéis de agentes e Inspector redimensionáveis por arraste em janelas largas.
- Larguras dos painéis persistidas no localStorage (`ophiuchus.panels.v06`).
- Inspector vira painel sobreposto em janelas com largura inferior a 1100 px.
- Área central com largura mínima flexível, rolagem própria e composer fixado ao final da área visível.
- Melhorias de quebra de texto, dimensionamento de cards, subtarefas e modo Engenharia.
- Adaptação de barra superior e componentes para janelas pequenas.

## Executar
```bash
npm install
npm run dev
```

## Validar
```bash
npm run build
```

## Limites
A orquestração, o catálogo de provedores e métricas continuam demonstrativos. Não há integração real com APIs, sandbox ou Tauri. O build completo não foi validado neste ambiente porque a instalação do npm excedeu o tempo disponível.
