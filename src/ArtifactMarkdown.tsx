import type { ReactNode } from 'react'

// Safe, dependency-free Markdown subset. All content is React-escaped; no HTML injection.
function inline(text:string):ReactNode[]{
 const pattern=/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g
 return text.split(pattern).filter(Boolean).map((part,i)=>{
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>
  if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>
  const match=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
  if(match)return <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a>
  return part
 })
}
export default function ArtifactMarkdown({text}:{text:string}){
 const lines=text.replace(/\r\n/g,'\n').split('\n')
 const nodes:ReactNode[]=[]
 let i=0
 while(i<lines.length){
  const line=lines[i]
  if(/^\s*```/.test(line)){
   const lang=line.trim().slice(3).trim();const code:string[]=[];i++
   while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++
   nodes.push(<div className="artifact-code" key={nodes.length}>{lang&&<span>{lang}</span>}<pre><code>{code.join('\n')}</code></pre></div>);continue
  }
  const heading=line.match(/^(#{1,4})\s+(.+)$/)
  if(heading){const content=inline(heading[2]);const key=nodes.length;nodes.push(heading[1].length<=2?<h3 key={key}>{content}</h3>:<h4 key={key}>{content}</h4>);i++;continue}
  if(/^\s*\|/.test(line)&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
   const split=(s:string)=>s.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());const headers=split(line);i+=2;const rows:string[][]=[]
   while(i<lines.length&&/^\s*\|/.test(lines[i]))rows.push(split(lines[i++]));
   nodes.push(<div className="artifact-table-scroll" key={nodes.length}><table><thead><tr>{headers.map((h,j)=><th key={j}>{inline(h)}</th>)}</tr></thead><tbody>{rows.map((r,j)=><tr key={j}>{r.map((v,k)=><td key={k}>{inline(v)}</td>)}</tr>)}</tbody></table></div>);continue
  }
  if(/^\s*(?:[-*]\s+|\d+[.)]\s+)/.test(line)){
   const items:string[]=[];const ordered=/^\s*\d+[.)]\s+/.test(line)
   while(i<lines.length&&/^\s*(?:[-*]\s+|\d+[.)]\s+)/.test(lines[i]))items.push(lines[i++].replace(/^\s*(?:[-*]\s+|\d+[.)]\s+)/,''))
   const children=items.map((v,j)=><li key={j}>{inline(v)}</li>);nodes.push(ordered?<ol key={nodes.length}>{children}</ol>:<ul key={nodes.length}>{children}</ul>);continue
  }
  if(!line.trim()){i++;continue}
  const paragraph=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,4}\s|\s*```|\s*\||\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i]))paragraph.push(lines[i++]);nodes.push(<p key={nodes.length}>{inline(paragraph.join(' '))}</p>)
 }
 return <div className="artifact-markdown">{nodes}</div>
}
