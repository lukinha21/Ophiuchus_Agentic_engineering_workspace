/** Bounded line-level diff; no external dependencies. */
export function lineDiff(before,after){
 const a=before.split('\n'),b=after.split('\n');
 if(a.length*b.length>250000)return {tooLarge:true,lines:[]};
 const dp=Array.from({length:a.length+1},()=>new Uint32Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 let i=0,j=0;const lines=[];
 while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){lines.push({kind:'same',text:a[i]});i++;j++;}
 else if(j<b.length&&(i===a.length||dp[i][j+1]>=dp[i+1][j])){lines.push({kind:'add',text:b[j++]});}
 else{lines.push({kind:'remove',text:a[i++]});}}
 return {tooLarge:false,lines};
}
