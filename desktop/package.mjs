import {packager} from '@electron/packager';import {readFile,mkdir,mkdtemp,cp,writeFile} from 'node:fs/promises';import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
await import('./create-icon.mjs');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
await mkdir(join(root,'desktop-stage'),{recursive:true});const stage=await mkdtemp(join(root,'desktop-stage','app-'));
for(const folder of ['desktop','runtime','dist'])await cp(join(root,folder),join(stage,folder),{recursive:true,filter:path=>!path.endsWith('.test.mjs')&&!path.endsWith('package.mjs')&&!path.endsWith('create-icon.mjs')});
await writeFile(join(stage,'package.json'),JSON.stringify({name:'ophiuchus',productName:'Ophiuchus',version:pkg.version,description:pkg.description,main:'desktop/main.cjs',type:'module'}));
const output=join(root,'desktop-build','v'+pkg.version+'-'+Date.now());
const result=await packager({dir:stage,out:output,name:'Ophiuchus',platform:'win32',arch:'x64',electronVersion:pkg.devDependencies.electron,icon:join(root,'desktop','icon.ico'),asar:false,prune:false,...(process.env.OPHIUCHUS_ELECTRON_ZIP_DIR?{electronZipDir:process.env.OPHIUCHUS_ELECTRON_ZIP_DIR}:{}),appVersion:pkg.version,win32metadata:{CompanyName:'Ophiuchus',FileDescription:'Ophiuchus — estúdio de engenharia',ProductName:'Ophiuchus',InternalName:'Ophiuchus'}});
await writeFile(join(root,'desktop-build','latest.json'),JSON.stringify({version:pkg.version,directory:result[0],executable:join(result[0],'Ophiuchus.exe')},null,2));console.log('DESKTOP_BUILD='+result[0]);
