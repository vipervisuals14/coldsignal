// Shared by the editor, live preview, PNG snapshots and offline video export.
// Keys use seconds relative to the selected export section, not song timestamps.
export const INTERPOLATIONS = ['linear', 'ease', 'hold'];
export const KEY_EPSILON = 1e-7;
let nextId = 1;
export function keyId(){return 'key-'+Date.now().toString(36)+'-'+nextId++;}
export function keyAt(keys,time){return (keys||[]).findLast(k=>Math.abs(k.time-time)<KEY_EPSILON)||null;}
export function snapTime(time,fps,duration){const rate=Number.isFinite(fps)&&fps>0?fps:24;const last=Math.max(0,Math.ceil(duration*rate-1e-9)-1);return Math.min(last,Math.max(0,Math.round(time*rate)))/rate;}
export function sampleTrack(keys,time,fallback=0){
 if(!keys?.length)return fallback;
 if(time<keys[0].time)return keys[0].value;
 if(time>=keys[keys.length-1].time)return keys[keys.length-1].value;
 let lo=0,hi=keys.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(keys[mid].time<=time)lo=mid;else hi=mid-1;}
 const a=keys[lo],b=keys[lo+1];if(!b)return a.value;
 const span=b.time-a.time;if(span<=KEY_EPSILON)return b.value;
 let u=Math.max(0,Math.min(1,(time-a.time)/span));
 if(a.interpolation==='hold')u=0;
 else if(a.interpolation==='ease')u=u*u*(3-2*u);
 return a.value+(b.value-a.value)*u;
}
export function evaluateParameters(base,tracks,time){const p={...base};for(const [name,keys]of Object.entries(tracks||{})){if(keys.length)p[name]=sampleTrack(keys,time,base[name]);}return p;}
export function upsertKey(keys,key){return [...(keys||[]).filter(k=>k.id!==key.id&&Math.abs(k.time-key.time)>=KEY_EPSILON),{...key}].sort((a,b)=>a.time-b.time);}
export function validateTracks(input,definitions){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Animation tracks must be an object.');
 const defs=new Map(definitions.filter(d=>!['lines','detail'].includes(d[0])).map(d=>[d[0],d]));
 const output={};let count=0;
 for(const [name,keys]of Object.entries(input)){
  const d=defs.get(name);if(!d)throw Error('Unsupported animated control: '+name);
  if(!Array.isArray(keys))throw Error('Invalid key list for '+name);
  let track=[];
  for(const k of keys){
   if(++count>10000)throw Error('This animation has too many keys (maximum 10,000).');
   if(!k||!Number.isFinite(k.time)||k.time<0||k.time>1800||!Number.isFinite(k.value))throw Error('Invalid keyframe time or value for '+name);
   const interpolation=k.interpolation||'linear';if(!INTERPOLATIONS.includes(interpolation))throw Error('Unknown keyframe interpolation.');
   track=upsertKey(track,{id:keyId(),time:k.time,value:Math.min(d[3],Math.max(d[2],k.value)),interpolation});
  }
  if(track.length)output[name]=track;
 }
 return output;
}
