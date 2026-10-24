/* Saved private data directory, including application kits and referenced PDF/HTML dependencies. */
window.createJobBackup=async adapter=>{
 const C=HubSettingsContract,B=SuiteBackup,files=new Set(Object.values(PATHS).concat(ApplyKits.path,REGIONS.map(r=>'data/'+r.id+'_jobs.json')));
 const allowed=p=>B.pathOK(p)&&(files.has(p)||/^data\/[a-z0-9_-]+_jobs\.json$/.test(p)||/^data\/files\/[^/]+\.(pdf|html)$/.test(p)||/^data\/apply-kits\/[a-z0-9_-]+\/[a-zA-Z0-9_.-]+\.pdf$/.test(p));
 const directory=p=>p==='data'||p==='data/files'||p==='data/apply-kits'||/^data\/apply-kits\/[a-z0-9_-]+$/.test(p);
 const decode=file=>Uint8Array.from(atob(file.content),c=>c.charCodeAt(0));
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 return B.create({
  ...adapter,connection(){const {owner,repo,token}=adapter.connection();return {owner,repo,token};},roots:['data',...files],allowed,directory,
  scope:'Complete saved Job Tracker files under data/: regional applications, profile sections and text, formatting, glossary, alert profile, resume library, diagnosis, application kits/progress, PDF and legacy HTML files. Browser-only and unsaved work excluded.',
  validate(p,value){
   if(p==='data/diagnosis.json'){if(!object(value)&&!(Array.isArray(value)&&value.length===0))throw new C.SettingsError('invalid');return;}
   if(p===ApplyKits.path){ApplyKits.validate(value);return;}
   if(p===PATHS.applyProgress){ApplyKits.validateProgress(value);return;}
   if(!Array.isArray(value)||value.some(v=>!object(v)))throw new C.SettingsError('invalid');
  },
  complete(entries,absent=[]){
   const paths=new Set(entries.map(f=>f.path));
   for(const root of files)if(!paths.has(root)&&!absent.includes(root))throw new C.SettingsError('invalid');
   if(absent.includes('data')||entries.some(f=>!allowed(f.path)))throw new C.SettingsError('invalid');
   function dependencies(value){
    if(typeof value==='string'&&/^data\/(?:files|apply-kits)\/.+\.(pdf|html)$/.test(value)){if(!allowed(value)||!paths.has(value))throw new C.SettingsError('invalid');}
    else if(Array.isArray(value))value.forEach(dependencies);
    else if(object(value))Object.values(value).forEach(dependencies);
   }
   for(const f of entries){
    const bytes=decode(f);
    if(f.path.endsWith('.json'))dependencies(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
    else if(f.path.endsWith('.txt')||f.path.endsWith('.html'))new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    else if(f.path.endsWith('.pdf')&&!new TextDecoder().decode(bytes.slice(0,5)).startsWith('%PDF-'))throw new C.SettingsError('invalid');
   }
  },
  summary:(n,bytes)=>adapter.language()==='zh'?`将恢复 ${n} 个已保存文件（${bytes} 字节），附件先写入；未列出的文件不删除。多文件写入可能中途停止。`:`Restore ${n} saved files (${bytes} bytes), attachments first. Unlisted files are not deleted. Multi-file writes can stop partway.`,
  partial:SuiteSettingsHelpers.partial,
  async reload(){adapter.invalidate();await adapter.reload();},
 });
};
