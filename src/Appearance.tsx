export const themes=[
 {id:'light',name:'Papel',description:'Claro e neutro',bg:'#f5f6f8',ink:'#202a38',accent:'#365db0',dark:false},
 {id:'dark',name:'Grafite',description:'Escuro sem dominante verde',bg:'#15171c',ink:'#e9edf5',accent:'#a4baff',dark:true},
 {id:'midnight',name:'Meia-noite',description:'Azul profundo',bg:'#111a2b',ink:'#e9efff',accent:'#a5bcff',dark:true},
 {id:'ocean',name:'Oceano',description:'Petróleo e água',bg:'#102325',ink:'#e5f3f2',accent:'#83d9cd',dark:true},
 {id:'sand',name:'Areia',description:'Claro e acolhedor',bg:'#f5f0e7',ink:'#382e25',accent:'#8a4c27',dark:false},
 {id:'forest',name:'Floresta',description:'Verde discreto',bg:'#14211c',ink:'#e7f0ea',accent:'#9ccfb4',dark:true}
] as const
export type ThemeId=typeof themes[number]['id']
export function readTheme():ThemeId{try{const id=localStorage.getItem('ophiuchus.theme');if(themes.some(t=>t.id===id))return id as ThemeId}catch{}return 'light'}
export function BrandMark({className=''}:{className?:string}){return <svg className={`ophi-brand-symbol ${className}`} viewBox="0 0 48 48" role="img" aria-label="Ophiuchus"><path d="M35 9a18 18 0 1 0 4 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M30 13c-12-3-18 10-6 11s8 14-5 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>{[[24,6],[40,15],[40,33],[24,42],[8,33],[8,15]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={i===1?3:2} fill="currentColor"/>)}</svg>}
export function ThemePicker({value,onChange}:{value:ThemeId;onChange:(theme:ThemeId)=>void}){return <div className="theme-picker" role="group" aria-label="Tema de cores">{themes.map(t=><button key={t.id} className={value===t.id?'selected':''} aria-pressed={value===t.id} onClick={()=>onChange(t.id)}><span className="theme-swatch" style={{background:t.bg,color:t.ink,borderColor:t.accent}}><i style={{background:t.accent}}/>Aa</span><span><strong>{t.name}</strong><small>{t.description}</small></span></button>)}</div>}
