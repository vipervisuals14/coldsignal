
'use strict';
function filter(type,hz,sr){const w=2*Math.PI*hz/sr,c=Math.cos(w),a=Math.sin(w)/(2*Math.SQRT1_2),d=1+a;let b0,b1,b2;if(type==='lp'){b0=(1-c)/2/d;b1=(1-c)/d;b2=b0}else{b0=(1+c)/2/d;b1=-(1+c)/d;b2=b0}return{b0,b1,b2,a1:-2*c/d,a2:(1-a)/d,z1:0,z2:0}}
function tick(f,x){const y=f.b0*x+f.z1;f.z1=f.b1*x-f.a1*y+f.z2;f.z2=f.b2*x-f.a2*y;return y}
self.onmessage=function(e){try{const {channels,sampleRate:sr,offset,fpsNum,fpsDen,frameCount}=e.data;const nc=channels.length,limit=channels[0].length;
const states=channels.map(()=>({bh:filter('hp',40,sr),bl:filter('lp',160,sr),hh:filter('hp',2000,sr),hl:filter('lp',Math.min(10000,sr*.45),sr)}));
const rms=new Float64Array(frameCount),bass=new Float64Array(frameCount),highs=new Float64Array(frameCount),peak=new Float64Array(frameCount);
const step=sr*fpsDen/fpsNum,previousStart=Math.max(0,offset-Math.ceil(step));let pr=0,pb=0,ph=0,pc=0;
for(let i=0;i<offset;i++){for(let c=0;c<nc;c++){let x=channels[c][i];if(!Number.isFinite(x))x=0;const st=states[c],b=tick(st.bl,tick(st.bh,x)),h=tick(st.hl,tick(st.hh,x));if(i>=previousStart){pr+=x*x;pb+=b*b;ph+=h*h;pc++}}}
const previous=pc?[Math.sqrt(pr/pc),Math.sqrt(pb/pc),Math.sqrt(ph/pc)]:[0,0,0];
const reportEvery=Math.max(1,Math.floor(frameCount/160));
for(let f=0;f<frameCount;f++){let r=0,b=0,h=0,p=0;const a=offset+Math.floor(f*step),z=Math.min(limit,offset+Math.floor((f+1)*step));
for(let i=a;i<z;i++){for(let c=0;c<nc;c++){let x=channels[c][i];if(!Number.isFinite(x))x=0;const st=states[c],bv=tick(st.bl,tick(st.bh,x)),hv=tick(st.hl,tick(st.hh,x));r+=x*x;b+=bv*bv;h+=hv*hv;const ax=Math.abs(x);if(ax>p)p=ax}}
const count=(z-a)*nc;if(count>0){rms[f]=Math.sqrt(r/count);bass[f]=Math.sqrt(b/count);highs[f]=Math.sqrt(h/count);peak[f]=p}
if(f%reportEvery===0)self.postMessage({type:'progress',value:(f+1)/frameCount});}
self.postMessage({type:'done',rms,bass,highs,peak,previous},[rms.buffer,bass.buffer,highs.buffer,peak.buffer]);
}catch(err){self.postMessage({type:'error',message:err.message||String(err)})}};
