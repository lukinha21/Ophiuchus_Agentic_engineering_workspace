// Session-only catalogue metadata. Credentials never enter this cache.
const key='ophiuchus.model-catalog.session.v1'
export type ModelCatalog=Record<string,string[]>
export function readModelCatalog():ModelCatalog{
 try{
  const value=JSON.parse(sessionStorage.getItem(key)||'{}'),catalog:ModelCatalog={}
  if(!value||typeof value!=='object'||Array.isArray(value))return catalog
  for(const [id,models] of Object.entries(value))if(/^[a-z]+$/.test(id)&&Array.isArray(models)&&models.every(m=>typeof m==='string'&&m.length<500))catalog[id]=models
  return catalog
 }catch{return {}}
}
export function saveModelCatalog(value:ModelCatalog){try{sessionStorage.setItem(key,JSON.stringify(value))}catch{/* Catalogue stays in component memory if storage is unavailable. */}}
