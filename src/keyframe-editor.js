import {evaluateParameters,sampleTrack,keyAt,keyId,upsertKey,snapTime,validateTracks,INTERPOLATIONS} from './keyframes.js';
const $=id=>document.getElementById(id);
const svg=(name,attrs={})=>{const el=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export class KeyframeEditor {
 constructor({state,definitions,onChange,onSeek,onPause,onRefreshControl,notify,saveBlob,getProject,applyProject}){
  Object.assign(this,{state,definitions,onChange,onSeek,onPause,onRefreshControl,notify,saveBlob,getProject,applyProject});
  this.defs=new Map(Object.values(definitions).flat().filter(d=>!['lines','detail'].includes(d[0])).map(d=>[d[0],d]));
  this.tracks={};this.active='height';this.defaultMode='linear';this.history=[];this.future=[];this.pending=null;this.drag=null;this.dirty=true;this.lastLayout='';
  const select=$('keyframeTrack');
  for(const[group,defs]of Object.entries(definitions)){const opt=document.createElement('optgroup');opt.label={raster:'Raster',camera:'Camera',signal:'Finish',music:'Music reaction'}[group];for(const d of defs){if(!this.defs.has(d[0]))continue;const o=document.createElement('option');o.value=d[0];o.textContent=d[1];o.dataset.label=d[1];opt.append(o)}select.append(opt)}
  select.value=this.active;select.onchange=()=>this.select(select.value);
  $('keyAdd').onclick=()=>this.add(this.active);
  $('keyDelete').onclick=()=>this.removeCurrent();
  $('keyClear').onclick=()=>this.clearTrack();
  $('keyPrev').onclick=()=>this.neighbour(-1);$('keyNext').onclick=()=>this.neighbour(1);
  $('keyUndo').onclick=()=>this.undo();$('keyRedo').onclick=()=>this.redo();
  $('keyframeTime').onchange=()=>this.editTime();
  $('keyframeValue').onchange=()=>{const v=Number($('keyframeValue').value);if($('keyframeValue').value===''||!Number.isFinite(v)){this.notify('Enter a numeric keyframe value.',true);return}this.beginEdit();this.writeControl(this.active,v,{forceKey:true});this.commitEdit();};
  $('keyInterpolation').onchange=()=>{const mode=$('keyInterpolation').value;this.defaultMode=mode;const key=this.currentKey();if(key){this.beginEdit();this.tracks[this.active]=upsertKey(this.tracks[this.active],{...key,interpolation:mode});this.commitEdit();this.changed();}};
  $('saveAnimation').onclick=()=>this.save();$('loadAnimation').onclick=()=>{if(this.busy())return;$('animationFile').value='';$('animationFile').click()};
  $('animationFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('Choose an animation JSON smaller than 2 MiB.');this.load(JSON.parse(await file.text()));}catch(err){this.notify(err.message,true)}};
  this.graph=$('keyframeGraph');this.graph.addEventListener('pointerdown',e=>this.pointerDown(e));this.graph.addEventListener('pointermove',e=>this.pointerMove(e));this.graph.addEventListener('pointerup',()=>this.pointerUp());this.graph.addEventListener('pointercancel',()=>this.cancelDrag());
  this.graph.addEventListener('dblclick',e=>{if(this.busy()||e.target.closest?.('[data-key-id]'))return;this.onPause();this.onSeek(this.pointerTime(e));this.add(this.active);});
  document.addEventListener('keydown',e=>this.keyboard(e));
  this.sync();
 }
 busy(){return this.state().exporting||this.state().loading;}
 canAnimate(id){return this.defs.has(id);}
 count(){return Object.values(this.tracks).reduce((n,a)=>n+a.length,0);}
 value(id,time=this.state().playhead){return sampleTrack(this.tracks[id],time,this.state().params[id]);}
 values(time=this.state().playhead){return evaluateParameters(this.state().params,this.tracks,time);}
 snapshot(){return{params:structuredClone(this.state().params),tracks:structuredClone(this.tracks),project:structuredClone(this.getProject())};}
 restore(s){this.state().params=structuredClone(s.params);this.tracks=structuredClone(s.tracks);this.dirty=true;if(s.project)this.applyProject(s.project);this.changed();}
 beginEdit(){if(this.busy())return;if(!this.pending)this.pending=this.snapshot();this.onPause();}
 commitEdit(){if(!this.pending)return;const before=this.pending;this.pending=null;if(!same(before,this.snapshot())){this.history.push(before);if(this.history.length>60)this.history.shift();this.future=[]}this.changed();}
 mutate(fn){if(this.busy())return;this.beginEdit();fn();this.commitEdit();}
 undo(){if(this.busy()||!this.history.length)return;this.onPause();this.pending=null;this.future.push(this.snapshot());this.restore(this.history.pop());}
 redo(){if(this.busy()||!this.future.length)return;this.onPause();this.pending=null;this.history.push(this.snapshot());this.restore(this.future.pop());}
 changed(){this.dirty=true;this.onChange();this.sync();}
 select(id){if(!this.defs.has(id))return;this.active=id;$('keyframeTrack').value=id;this.dirty=true;this.sync();}
 currentKey(){if(this.drag)return(this.tracks[this.active]||[]).find(k=>k.id===this.drag.id)||null;return keyAt(this.tracks[this.active],this.state().playhead);}
 writeControl(id,value,{forceKey=false,select=true}={}){
  if(this.busy())return;const d=this.defs.get(id);if(!d){this.state().params[id]=value;this.onChange();return}
  if(select)this.select(id);value=Math.max(d[2],Math.min(d[3],value));
  if(forceKey||this.tracks[id]?.length){const s=this.state(),time=snapTime(s.playhead,s.fps,s.duration),existing=keyAt(this.tracks[id],time);this.tracks[id]=upsertKey(this.tracks[id],{id:existing?.id||keyId(),time,value,interpolation:existing?.interpolation||this.defaultMode});this.dirty=true;if(Math.abs(time-s.playhead)>1e-8)this.onSeek(time);}
  else this.state().params[id]=value;
  this.changed();
 }
 add(id){if(this.busy()||!this.defs.has(id))return;this.select(id);this.mutate(()=>{const s=this.state(),time=snapTime(s.playhead,s.fps,s.duration),old=keyAt(this.tracks[id],time);const value=this.value(id,time);this.tracks[id]=upsertKey(this.tracks[id],{id:old?.id||keyId(),time,value,interpolation:old?.interpolation||this.defaultMode});this.onSeek(time);});}
 toggle(id){if(this.busy())return;this.select(id);if(keyAt(this.tracks[id],this.state().playhead))this.removeCurrent();else this.add(id);}
 removeCurrent(){const key=this.currentKey();if(!key||this.busy())return;this.mutate(()=>{const value=this.value(this.active);const remaining=this.tracks[this.active].filter(k=>k.id!==key.id);if(remaining.length)this.tracks[this.active]=remaining;else{delete this.tracks[this.active];this.state().params[this.active]=value;}});}
 clearTrack(){if(!this.tracks[this.active]?.length||this.busy())return;this.mutate(()=>{this.state().params[this.active]=this.value(this.active);delete this.tracks[this.active]});}
 clearProperties(ids){for(const id of ids)delete this.tracks[id];this.dirty=true;}
 neighbour(direction){const s=this.state(),keys=(this.tracks[this.active]||[]).filter(k=>k.time<s.duration+1e-8);const key=direction<0?keys.findLast(k=>k.time<s.playhead-1e-7):keys.find(k=>k.time>s.playhead+1e-7);if(key){this.onPause();this.onSeek(key.time);}}
 editTime(){if(this.busy())return;const value=Number($('keyframeTime').value);if(!Number.isFinite(value))return;const s=this.state(),time=snapTime(value,s.fps,s.duration),key=this.currentKey();if(!key){this.onPause();this.onSeek(time);return}this.mutate(()=>{this.tracks[this.active]=upsertKey(this.tracks[this.active],{...key,time});this.onSeek(time);});}
 pointerTime(e){const b=this.graph.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*1000;return snapTime(Math.max(0,Math.min(1,(x-32)/952))*this.state().duration,this.state().fps,this.state().duration);}
 pointerDown(e){if(this.busy()||e.button!==0)return;e.preventDefault();this.graph.focus({preventScroll:true});this.onPause();const target=e.target.closest?.('[data-key-id]');if(target){const key=(this.tracks[this.active]||[]).find(k=>k.id===target.getAttribute('data-key-id'));if(!key)return;this.onSeek(key.time);this.beginEdit();this.drag={id:key.id,key:{...key},original:structuredClone(this.tracks[this.active])};this.graph.setPointerCapture(e.pointerId);this.sync();}else this.onSeek(this.pointerTime(e));}
 pointerMove(e){if(!this.drag||this.busy())return;const time=this.pointerTime(e);this.tracks[this.active]=[...this.drag.original.filter(k=>k.id!==this.drag.id),{...this.drag.key,time}].sort((a,b)=>a.time-b.time);this.dirty=true;this.onSeek(time);this.changed();}
 pointerUp(){if(!this.drag)return;const final=(this.tracks[this.active]||[]).find(k=>k.id===this.drag.id);this.tracks[this.active]=upsertKey(this.drag.original,final);this.drag=null;this.commitEdit();}
 cancelDrag(){if(!this.drag)return;this.tracks[this.active]=this.drag.original;this.drag=null;this.pending=null;this.changed();}
 keyboard(e){if(this.busy()||document.querySelector('dialog[open]'))return;const el=document.activeElement;if(/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName))return;const inEditor=$('keyframeEditor').contains(el)||el?.classList?.contains('key-diamond');if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&inEditor){e.preventDefault();e.shiftKey?this.redo():this.undo();return}if(!inEditor)return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();this.removeCurrent()}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const s=this.state();this.onPause();this.onSeek(snapTime(s.playhead+(e.key==='ArrowLeft'?-1:1)/s.fps,s.fps,s.duration));}}
 sync(){
  const s=this.state(),d=this.defs.get(this.active),keys=this.tracks[this.active]||[],current=this.currentKey(),layout=[s.duration,s.fps,this.active].join(':');
  if(layout!==this.lastLayout){this.lastLayout=layout;this.dirty=true}
  if(this.dirty){this.draw();this.dirty=false;for(const o of $('keyframeTrack').querySelectorAll('option')){const n=this.tracks[o.value]?.length||0;o.textContent=o.dataset.label+(n?' · '+n+' keys':'')}}
  const x=32+Math.max(0,Math.min(1,s.playhead/s.duration))*952;const head=$('keyframePlayhead');if(head){head.setAttribute('x1',x);head.setAttribute('x2',x)}
  $('keyframeCount').textContent=this.count()+' KEY'+(this.count()===1?'':'S');
  $('keyframePosition').textContent='F '+Math.floor(s.playhead*s.fps+1e-6).toString().padStart(5,'0')+' · '+s.playhead.toFixed(3)+'s';
  const outside=keys.filter(k=>k.time>s.duration).length;$('keyframeHint').textContent=outside?`${outside} key(s) are beyond this section; they are retained, not rescaled.`:keys.length?'Drag a diamond to retime · edits auto-key this control · Delete removes the current key.':'Click ◇ beside a slider, move the playhead, then change the slider to create your next key.';
  for(const id of this.defs.keys()){const button=$('key-'+id);if(!button)continue;const has=!!this.tracks[id]?.length,at=!!keyAt(this.tracks[id],s.playhead);button.classList.toggle('animated',has);button.classList.toggle('at-key',at);button.setAttribute('aria-pressed',String(at));button.title=(at?'Remove keyframe':'Add keyframe')+' for '+this.defs.get(id)[1]+' at the playhead';button.textContent=at?'◆':'◇';if(has)this.onRefreshControl(id);}
  $('keyDelete').disabled=!current||this.busy();$('keyClear').disabled=!keys.length||this.busy();$('keyUndo').disabled=!this.history.length||this.busy();$('keyRedo').disabled=!this.future.length||this.busy();$('keyAdd').disabled=this.busy();
  $('keyPrev').disabled=!keys.some(k=>k.time<s.playhead-1e-7&&k.time<=s.duration);$('keyNext').disabled=!keys.some(k=>k.time>s.playhead+1e-7&&k.time<=s.duration);
  if(document.activeElement!==$('keyframeTime'))$('keyframeTime').value=s.playhead.toFixed(6).replace(/0+$/,'').replace(/\.$/,'')||'0';
  $('keyframeTime').step=1/s.fps;$('keyframeTime').max=Math.max(0,Math.ceil(s.duration*s.fps-1e-9)-1)/s.fps;
  const value=$('keyframeValue');value.min=d[2];value.max=d[3];value.step=d[4];if(document.activeElement!==value)value.value=this.value(this.active).toFixed(Math.max(d[5],3));
  if(document.activeElement!==$('keyInterpolation'))$('keyInterpolation').value=current?.interpolation||this.defaultMode;
  for(const marker of this.graph.querySelectorAll('[data-key-id]'))marker.classList.toggle('selected',marker.getAttribute('data-key-id')===current?.id);
 }
 draw(){
  const s=this.state(),d=this.defs.get(this.active),keys=this.tracks[this.active]||[],g=this.graph;g.replaceChildren();
  const px=t=>32+Math.max(0,Math.min(1,t/s.duration))*952,py=v=>104-(v-d[2])/(d[3]-d[2])*86;
  for(let i=0;i<=4;i++){const x=32+952*i/4;g.append(svg('line',{x1:x,x2:x,y1:12,y2:109,class:'kf-grid'}));const text=svg('text',{x,y:126,'text-anchor':i===0?'start':i===4?'end':'middle',class:'kf-axis'});text.textContent=(s.duration*i/4).toFixed(s.duration<10?2:1)+'s';g.append(text)}
  for(const v of [d[2],(d[2]+d[3])/2,d[3]]){const y=py(v);g.append(svg('line',{x1:32,x2:984,y1:y,y2:y,class:'kf-grid'}));const text=svg('text',{x:26,y:y+3,'text-anchor':'end',class:'kf-axis'});text.textContent=Number(v.toFixed(d[5]));g.append(text)}
  const times=Array.from({length:193},(_,i)=>s.duration*i/192);for(const k of keys)if(k.time>0&&k.time<s.duration)times.push(k.time,Math.max(0,k.time-1e-6));times.sort((a,b)=>a-b);
  const points=times.map(t=>[px(t),py(sampleTrack(keys,t,s.params[this.active]))]);const path=points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(3)+' '+y.toFixed(3)).join(' ');
  g.append(svg('path',{d:path,fill:'none',class:keys.length?'kf-curve':'kf-curve kf-empty'}));
  for(const k of keys){if(k.time<0||k.time>s.duration)continue;const x=px(k.time),y=py(k.value),marker=svg('g',{'data-key-id':k.id,class:'kf-marker',role:'button','aria-label':`${d[1]} key at ${k.time.toFixed(3)} seconds, value ${k.value}`});marker.append(svg('circle',{cx:x,cy:y,r:13,class:'kf-hit'}));marker.append(svg('path',{d:`M${x} ${y-6}L${x+6} ${y}L${x} ${y+6}L${x-6} ${y}Z`}));const title=svg('title');title.textContent=`${k.time.toFixed(3)}s · ${k.value.toFixed(d[5])} · ${k.interpolation}`;marker.append(title);g.append(marker)}
  g.append(svg('line',{id:'keyframePlayhead',x1:px(s.playhead),x2:px(s.playhead),y1:8,y2:111,class:'kf-playhead'}));
 }
 save(){if(this.busy())return;const data={app:'ColdSignal Animation',schema:1,timeUnit:'seconds',params:structuredClone(this.state().params),tracks:structuredClone(this.tracks),project:this.getProject()};this.saveBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'ColdSignal_Animation.json');this.notify('Animation saved: keys, base settings and timing. Media files are not included.');}
 load(data){
  if(this.busy())return;if(data?.app!=='ColdSignal Animation'||data.schema!==1||data.timeUnit!=='seconds')throw Error('Choose a ColdSignal Animation JSON file.');
  const tracks=validateTracks(data.tracks,Object.values(this.definitions).flat()),params={...this.state().params};
  for(const d of Object.values(this.definitions).flat()){const v=data.params?.[d[0]];if(typeof v==='number'&&Number.isFinite(v))params[d[0]]=Math.max(d[2],Math.min(d[3],v))}
  for(const k of ['xray','cameraEnabled','musicEnabled'])if(typeof data.params?.[k]==='boolean')params[k]=data.params[k];
  if(Number.isInteger(data.params?.cameraPreset))params.cameraPreset=Math.max(0,Math.min(3,data.params.cameraPreset));
  if(/^#[\da-f]{6}$/i.test(data.params?.hex)){params.hex=data.params.hex;params.colour=[1,3,5].map(i=>parseInt(params.hex.slice(i,i+2),16)/255)}
  const project=data.project;if(project){if(!Number.isFinite(project.start)||project.start<0||!Number.isFinite(project.duration)||project.duration<=0||project.duration>1800||!Array.from($('exportFps').options).some(o=>o.value===project.fps)||!Number.isFinite(project.syncDelay)||Math.abs(project.syncDelay)>2400)throw Error('The animation contains invalid project timing.');}
  this.mutate(()=>{this.state().params=params;this.tracks=tracks;if(project)this.applyProject(project);this.onSeek(0)});
  if(!this.tracks[this.active])this.select(Object.keys(this.tracks)[0]||'height');
  this.notify('Animation loaded. Choose the matching media locally; check the section duration before export.');
 }
}
