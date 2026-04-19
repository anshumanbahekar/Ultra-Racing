/* ================================================================
   ULTRA RACING — game.js
   Renderer, Camera, HUD, AI, Player, Race Manager, Menu system
   ================================================================ */

// ────────────────────────────────────────────────────────────────
// CAMERA
// ────────────────────────────────────────────────────────────────
class Camera{
  constructor(w,h){this.w=w;this.h=h;this.cx=w/2;this.cy=h/2;this.x=0;this.y=0;this.z=1;this.tz=1;this.shake=0;this.sx=0;this.sy=0}
  resize(w,h){this.w=w;this.h=h;this.cx=w/2;this.cy=h/2}
  follow(x,y,speed,dt){
    this.tz=U.clamp(U.lerp(1.45,.68,speed/80),.62,1.6);
    this.x=U.lerp(this.x,x,Math.min(1,dt*7));
    this.y=U.lerp(this.y,y,Math.min(1,dt*7));
    this.z=U.lerp(this.z,this.tz,dt*3);
    if(this.shake>0){this.sx=(Math.random()-.5)*this.shake;this.sy=(Math.random()-.5)*this.shake;this.shake*=.84;if(this.shake<.08)this.shake=0}else{this.sx=0;this.sy=0}
  }
  ws(wx,wy){return{x:(wx-this.x)*this.z+this.cx+this.sx,y:(wy-this.y)*this.z+this.cy+this.sy}}
  addShake(a){this.shake=Math.min(this.shake+a,18)}
}

// ────────────────────────────────────────────────────────────────
// RENDERER
// ────────────────────────────────────────────────────────────────
class Renderer{
  constructor(canvas){
    this.cv=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.cam=new Camera(canvas.width,canvas.height);
    this.time=0;this._buf=null;this._dirty=true;
  }
  resize(w,h){this.cv.width=w;this.cv.height=h;this.cam.resize(w,h);this._dirty=true}

  bakeTrack(track){
    const bx=track.bbox,ww=bx.maxX-bx.minX,wh=bx.maxY-bx.minY;
    const SC=2;
    const buf=document.createElement('canvas');
    buf.width=Math.min(4096,ww*SC+200);buf.height=Math.min(4096,wh*SC+200);
    const c=buf.getContext('2d');
    const ox=-bx.minX*SC+100,oy=-bx.minY*SC+100;
    const tx=x=>x*SC+ox,ty=y=>y*SC+oy;

    // Grass bg
    const gg=c.createRadialGradient(buf.width/2,buf.height/2,0,buf.width/2,buf.height/2,Math.max(buf.width,buf.height)/1.5);
    gg.addColorStop(0,'#1a2e12');gg.addColorStop(1,'#0d180a');
    c.fillStyle=gg;c.fillRect(0,0,buf.width,buf.height);
    // Grid lines on grass
    c.strokeStyle='rgba(255,255,255,0.015)';c.lineWidth=1;
    for(let gy=0;gy<buf.height;gy+=14){c.beginPath();c.moveTo(0,gy);c.lineTo(buf.width,gy);c.stroke()}

    const cl=track.centerline,n=cl.length,nm=track.normals;
    const hw=(track.width/2)*SC,rw=2.6*SC;

    // Road shadow
    c.save();c.shadowColor='rgba(0,0,0,0.55)';c.shadowBlur=14*SC;c.shadowOffsetX=2*SC;c.shadowOffsetY=3*SC;
    c.fillStyle='#000';c.beginPath();
    for(let i=0;i<n;i++){const p=cl[i],nm2=nm[i];const x=tx(p.x+nm2.x*(hw+rw)/SC*1.08),y=ty(p.y+nm2.y*(hw+rw)/SC*1.08);i===0?c.moveTo(x,y):c.lineTo(x,y)}
    for(let i=n-1;i>=0;i--){const p=cl[i],nm2=nm[i];c.lineTo(tx(p.x-nm2.x*(hw+rw)/SC*1.08),ty(p.y-nm2.y*(hw+rw)/SC*1.08))}
    c.closePath();c.fill();c.restore();

    // Rumble strips
    for(const side of[1,-1]){
      for(let i=0;i<n;i++){
        const p=cl[i],nm2=nm[i],np=cl[(i+1)%n],nm3=nm[(i+1)%n];
        c.fillStyle=(Math.floor(i/6)%2===0)?'rgba(215,28,28,0.92)':'rgba(240,240,240,0.92)';
        c.beginPath();
        c.moveTo(tx(p.x+nm2.x*side*hw/SC),ty(p.y+nm2.y*side*hw/SC));
        c.lineTo(tx(p.x+nm2.x*side*(hw+rw)/SC),ty(p.y+nm2.y*side*(hw+rw)/SC));
        c.lineTo(tx(np.x+nm3.x*side*(hw+rw)/SC),ty(np.y+nm3.y*side*(hw+rw)/SC));
        c.lineTo(tx(np.x+nm3.x*side*hw/SC),ty(np.y+nm3.y*side*hw/SC));
        c.closePath();c.fill();
      }
    }

    // Road
    c.beginPath();
    for(let i=0;i<n;i++){const p=cl[i],nm2=nm[i];const x=tx(p.x+nm2.x*hw/SC),y=ty(p.y+nm2.y*hw/SC);i===0?c.moveTo(x,y):c.lineTo(x,y)}
    for(let i=n-1;i>=0;i--){const p=cl[i],nm2=nm[i];c.lineTo(tx(p.x-nm2.x*hw/SC),ty(p.y-nm2.y*hw/SC))}
    c.closePath();
    const rg=c.createLinearGradient(0,0,buf.width,buf.height);
    rg.addColorStop(0,'#2b2b2b');rg.addColorStop(.5,'#252525');rg.addColorStop(1,'#212121');
    c.fillStyle=rg;c.fill();
    // Asphalt grain
    for(let gi=0;gi<3500;gi++){const gv=Math.floor(Math.random()*28+12);c.fillStyle=`rgba(${gv},${gv},${gv},0.5)`;c.fillRect(Math.random()*buf.width,Math.random()*buf.height,1,1)}

    // Center dashes
    c.setLineDash([20*SC,14*SC]);c.strokeStyle='rgba(255,255,255,0.16)';c.lineWidth=1.5;
    c.beginPath();cl.forEach((p,i)=>{i===0?c.moveTo(tx(p.x),ty(p.y)):c.lineTo(tx(p.x),ty(p.y))});c.closePath();c.stroke();c.setLineDash([]);

    // Edge lines
    for(const side of[1,-1]){
      c.strokeStyle='rgba(255,255,255,0.52)';c.lineWidth=2.5;
      c.beginPath();cl.forEach((p,i)=>{const nm2=nm[i];const x=tx(p.x+nm2.x*side*hw/SC*.93),y=ty(p.y+nm2.y*side*hw/SC*.93);i===0?c.moveTo(x,y):c.lineTo(x,y)});c.stroke();
    }

    // Start/finish
    {const p=cl[0],nm2=nm[0],t2=track.tangents[0];const lw=(hw+rw)*2;const sq=10;
      c.save();c.translate(tx(p.x),ty(p.y));c.rotate(Math.atan2(t2.y,t2.x)+Math.PI/2);
      for(let col=0;col<lw/sq;col++){for(let row=0;row<3;row++){c.fillStyle=(col+row)%2===0?'#fff':'#000';c.fillRect(col*sq-lw/2,row*sq-sq*1.5,sq,sq)}}
      c.restore()}

    this._buf=buf;this._SC=SC;this._bufOX=bx.minX*SC-100;this._bufOY=bx.minY*SC-100;this._dirty=false;
  }

  _drawTrack(ctx,cam){
    if(!this._buf)return;
    const ds=cam.z/this._SC;
    const tlX=(-this._bufOX/this._SC-cam.x)*cam.z+cam.cx+cam.sx;
    const tlY=(-this._bufOY/this._SC-cam.y)*cam.z+cam.cy+cam.sy;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(this._buf,tlX,tlY,this._buf.width*ds,this._buf.height*ds);
  }

  _drawSkids(ctx,cam,marks){
    ctx.save();ctx.lineWidth=Math.max(.5,1.6*cam.z);
    for(const m of marks){
      const s1=cam.ws(m.x1,m.y1),s2=cam.ws(m.x2,m.y2);
      ctx.strokeStyle=`rgba(18,12,8,${m.a})`;ctx.beginPath();ctx.moveTo(s1.x,s1.y);ctx.lineTo(s2.x,s2.y);ctx.stroke();
    }
    ctx.restore();
  }

  _drawCar(ctx,cam,carObj,isPlayer){
    const p=carObj.physics,def=carObj.def,sp=cam.ws(p.x,p.y),z=cam.z;
    const W=1.9*z,L=4.2*z,bev=W*.18;
    ctx.save();ctx.translate(sp.x,sp.y);ctx.rotate(p.heading);
    // Shadow
    ctx.save();ctx.shadowColor='rgba(0,0,0,0.55)';ctx.shadowBlur=10*z;ctx.shadowOffsetX=2*z;ctx.shadowOffsetY=3*z;
    ctx.fillStyle=def.bodyColor;ctx.fillRect(-L/2,-W/2,L,W);ctx.restore();
    // Body
    const bg=ctx.createLinearGradient(-L/2,-W/2,-L/2,W/2);
    bg.addColorStop(0,def.trimColor);bg.addColorStop(.3,def.bodyColor);bg.addColorStop(.7,def.bodyColor);bg.addColorStop(1,'rgba(0,0,0,0.55)');
    ctx.fillStyle=bg;
    ctx.beginPath();ctx.moveTo(-L/2+bev,-W/2);ctx.lineTo(L/2-bev,-W/2);ctx.lineTo(L/2,-W/2+bev);ctx.lineTo(L/2,W/2-bev);ctx.lineTo(L/2-bev,W/2);ctx.lineTo(-L/2+bev,W/2);ctx.lineTo(-L/2,W/2-bev);ctx.lineTo(-L/2,-W/2+bev);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.65)';ctx.lineWidth=.5*z;ctx.stroke();
    // Roof
    const rL=L*.32,rW=W*.72,rX=-L*.06;
    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.beginPath();ctx.roundRect(rX-rL/2,-rW/2,rL,rW,rW*.15);ctx.fill();
    // Windshield glare
    const wg=ctx.createLinearGradient(rX-rL/2,-rW/2,rX+rL/2,rW/2);wg.addColorStop(0,'rgba(200,220,255,0.32)');wg.addColorStop(1,'rgba(100,130,200,0.04)');
    ctx.fillStyle=wg;ctx.beginPath();ctx.roundRect(rX-rL/2+z,-rW/2+z,rL-2*z,rW-2*z,rW*.12);ctx.fill();
    // Headlights
    for(const hy of[-W/2+W*.18,W/2-W*.18]){
      if(isPlayer){ctx.save();ctx.shadowColor='#ffffcc';ctx.shadowBlur=18*z;ctx.fillStyle='#ffffee';ctx.beginPath();ctx.arc(L/2-W*.12,hy,W*.1,0,Math.PI*2);ctx.fill();ctx.restore()}
      ctx.fillStyle='#ffffee';ctx.beginPath();ctx.arc(L/2-W*.12,hy,W*.09,0,Math.PI*2);ctx.fill();
    }
    // Tail lights
    for(const hy of[-W/2+W*.18,W/2-W*.18]){
      const brk=p.brake>.3||p.speed<2;
      ctx.save();if(brk){ctx.shadowColor='#ff2020';ctx.shadowBlur=14*z}
      ctx.fillStyle=brk?'#ff2020':'#880010';ctx.beginPath();ctx.arc(-L/2+W*.1,hy,W*.08,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // Wheels
    const wPos=[{x:L*.32,y:-W/2},{x:L*.32,y:W/2},{x:-L*.28,y:-W/2},{x:-L*.28,y:W/2}];
    const wRot=this.time*p.speed*2.5;
    for(let wi=0;wi<4;wi++){
      const wh=wPos[wi];ctx.save();ctx.translate(wh.x,wh.y);ctx.rotate(wi<2?p.steer:0);
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(0,0,W*.22,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=isPlayer?'#ddd':'#bbb';ctx.beginPath();ctx.arc(0,0,W*.14,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#555';ctx.lineWidth=.7*z;
      for(let s=0;s<5;s++){const a=wRot+s*Math.PI*.4;ctx.beginPath();ctx.moveTo(Math.cos(a)*W*.04,Math.sin(a)*W*.04);ctx.lineTo(Math.cos(a)*W*.12,Math.sin(a)*W*.12);ctx.stroke()}
      ctx.restore();
    }
    // Race number
    ctx.fillStyle=isPlayer?def.color:def.bodyColor;ctx.fillRect(-W*.5,-W*.18,W,W*.36);
    ctx.fillStyle='#fff';ctx.font=`bold ${W*.3}px Orbitron,monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(isPlayer?'P':(carObj.raceNum||'?'),0,0);
    // Nitro glow
    if(p.usingNitro){ctx.save();ctx.shadowColor='#00f5ff';ctx.shadowBlur=32*z;ctx.strokeStyle='#00f5ff';ctx.lineWidth=1.5*z;ctx.beginPath();ctx.roundRect(-L/2,-W/2,L,W,bev);ctx.stroke();ctx.restore()}
    // Damage tint
    if(p.damage<.7){ctx.fillStyle=`rgba(255,80,0,${(1-p.damage)*.45})`;ctx.fillRect(-L/2,-W/2,L,W)}
    ctx.restore();
  }

  _postFX(ctx,cam,speed){
    const w=cam.w,h=cam.h;
    // Vignette
    const vg=ctx.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,Math.max(w,h)*.75);
    vg.addColorStop(0,'transparent');vg.addColorStop(1,'rgba(0,0,0,0.52)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
    // Motion blur at high speed
    if(speed>28){
      const a=U.clamp((speed-28)/60,0,.14);
      for(const [x1,y1,x2,y2] of[[0,0,w*.2,0],[w,0,w*.8,0]]){
        const g=ctx.createLinearGradient(x1,0,x2,0);g.addColorStop(0,`rgba(0,0,0,${a})`);g.addColorStop(1,'transparent');
        ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      }
    }
    // Chromatic aberration at extreme speed
    if(speed>55){
      const a=U.clamp((speed-55)/60,0,.05);
      ctx.save();ctx.globalCompositeOperation='screen';
      ctx.fillStyle=`rgba(255,60,60,${a})`;ctx.fillRect(1,0,w,h);
      ctx.fillStyle=`rgba(60,60,255,${a})`;ctx.fillRect(-1,0,w,h);
      ctx.restore();
    }
  }

  render(dt,track,player,ais,parts){
    this.time+=dt;
    const ctx=this.ctx,cam=this.cam,w=cam.w,h=cam.h,p=player.physics;
    cam.follow(p.x,p.y,p.speed,dt);
    ctx.fillStyle='#0d180a';ctx.fillRect(0,0,w,h);
    // Subtle grid
    ctx.strokeStyle='rgba(255,255,255,0.025)';ctx.lineWidth=.5;
    const gl=cam.ws(-1000,-1000),gr=cam.ws(2000,2000);
    for(let gx=Math.floor(gl.x/50)*50;gx<gr.x;gx+=50*cam.z){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke()}
    for(let gy=Math.floor(gl.y/50)*50;gy<gr.y;gy+=50*cam.z){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke()}
    this._drawTrack(ctx,cam);
    // Skids
    const allC=[player,...ais];
    for(const c of allC)this._drawSkids(ctx,cam,c.skidMarks);
    // Particles
    parts.render(ctx,{x:cam.x,y:cam.y,z:cam.z,cx:cam.cx,cy:cam.cy,w,h,sx:cam.sx,sy:cam.sy});
    // AI cars
    for(let i=0;i<ais.length;i++){ais[i].raceNum=i+2;this._drawCar(ctx,cam,ais[i],false)}
    // Player
    this._drawCar(ctx,cam,player,true);
    this._postFX(ctx,cam,p.speed);
  }
}

// ────────────────────────────────────────────────────────────────
// PLAYER CAR WRAPPER
// ────────────────────────────────────────────────────────────────
class PlayerCar{
  constructor(def,pos){
    this.def=def;
    this.physics=new CarPhysics(def.phys);
    this.physics.x=pos.x;this.physics.y=pos.y;this.physics.heading=pos.heading;
    this.input={throttle:0,brake:0,left:false,right:false,handbrake:false,nitro:false};
    this.steer=0;
    this.lap=1;this.lapTimes=[];this.curLapTime=0;this.bestLap=Infinity;this.raceTime=0;
    this.lastProg=-1;this.skidMarks=[];this._lastSkid=null;
  }
  update(dt,track){
    const p=this.physics;
    const maxSt=U.toRad(32)*(1-U.clamp(p.speed/80,0,.45));
    const ss=4.5;
    if(this.input.left) this.steer=U.lerp(this.steer,-maxSt,ss*dt);
    else if(this.input.right)this.steer=U.lerp(this.steer,maxSt,ss*dt);
    else this.steer=U.lerp(this.steer,0,ss*1.5*dt);
    p.steer=this.steer;p.throttle=this.input.throttle;p.brake=this.input.brake;
    p.handbrake=this.input.handbrake;p.usingNitro=this.input.nitro;
    p.onGrass=!track.isOnTrack(p.x,p.y);
    p.step(dt);
    // Skid marks
    if((Math.abs(p.slipAngle)>.17||p.wheelspin>.09||p.handbrake)&&p.speed>3){
      const hw=1.8,px2=-Math.sin(p.heading),py2=Math.cos(p.heading);
      const lx=p.x+px2*hw*.5,ly=p.y+py2*hw*.5,rx=p.x-px2*hw*.5,ry=p.y-py2*hw*.5;
      if(this._lastSkid){
        const a=U.clamp((Math.abs(p.slipAngle)-.08)/.5*.55,0,.55);
        this.skidMarks.push({x1:this._lastSkid.lx,y1:this._lastSkid.ly,x2:lx,y2:ly,a});
        this.skidMarks.push({x1:this._lastSkid.rx,y1:this._lastSkid.ry,x2:rx,y2:ry,a});
      }
      this._lastSkid={lx,ly,rx,ry};
      if(this.skidMarks.length>1800)this.skidMarks.splice(0,200);
    }else this._lastSkid=null;
    // Lap tracking
    const{prog}=track.nearest(p.x,p.y);
    if(this.lastProg>=0&&this.lastProg>.85&&prog<.15){
      if(this.lap>1){this.lapTimes.push(this.curLapTime);if(this.curLapTime<this.bestLap)this.bestLap=this.curLapTime}
      this.curLapTime=0;this.lap++;
    }
    this.lastProg=prog;this.curLapTime+=dt*1000;this.raceTime+=dt*1000;
  }
}

// ────────────────────────────────────────────────────────────────
// AI CAR
// ────────────────────────────────────────────────────────────────
class AICar{
  constructor(def,pos,diff=.8){
    this.def=def;this.physics=new CarPhysics({...def.phys});
    this.physics.x=pos.x;this.physics.y=pos.y;this.physics.heading=pos.heading;
    this.diff=diff;this.lap=1;this.lapTimes=[];this.curLapTime=0;this.bestLap=Infinity;this.raceTime=0;
    this.lastProg=-1;this.targetIdx=20;this.skidMarks=[];this._lastSkid=null;
  }
  update(dt,track,playerProg){
    const p=this.physics,n=track.centerline.length;
    const look=Math.floor(8+p.speed*.9);
    const tIdx=(this.targetIdx+look)%n;
    const tgt=track.centerline[tIdx];
    const desH=Math.atan2(tgt.y-p.y,tgt.x-p.x);
    const hErr=U.normAngle(desH-p.heading);
    p.steer=U.clamp(hErr*1.85,-U.toRad(36),U.toRad(36));
    // Corner speed
    const farIdx=(this.targetIdx+42)%n,farTgt=track.centerline[farIdx];
    const cAngle=Math.abs(U.normAngle(Math.atan2(farTgt.y-tgt.y,farTgt.x-tgt.x)-Math.atan2(tgt.y-p.y,tgt.x-p.x)));
    const cSpd=U.lerp(20,58,1-cAngle/(Math.PI/2))*this.diff*(this.def.stats.speed/80);
    const spd=p.speedKmh;
    if(spd<cSpd*this.diff){p.throttle=U.lerp(.7,1,this.diff);p.brake=0}
    else{p.throttle=.08;p.brake=U.clamp((spd-cSpd*this.diff)/28,0,.9)}
    if(cAngle<.08&&p.nitro>.3&&Math.random()<.003)p.usingNitro=true;else if(Math.random()<.008)p.usingNitro=false;
    // Rubber band vs player
    const myProg=track.nearest(p.x,p.y).prog+this.lap;
    const gap=playerProg-myProg;
    const bnd=U.clamp(gap*.035,-.15,.15);
    p.throttle=U.clamp(p.throttle*(1+bnd),0,1.08);
    p.onGrass=!track.isOnTrack(p.x,p.y);
    p.step(dt);
    // Update target
    this.targetIdx=track.nearest(p.x,p.y).idx;
    // Skid marks
    if((Math.abs(p.slipAngle)>.22||p.wheelspin>.14)&&p.speed>3){
      const hw=1.7,px2=-Math.sin(p.heading),py2=Math.cos(p.heading);
      const lx=p.x+px2*hw*.5,ly=p.y+py2*hw*.5,rx=p.x-px2*hw*.5,ry=p.y-py2*hw*.5;
      if(this._lastSkid){this.skidMarks.push({x1:this._lastSkid.lx,y1:this._lastSkid.ly,x2:lx,y2:ly,a:.28});this.skidMarks.push({x1:this._lastSkid.rx,y1:this._lastSkid.ry,x2:rx,y2:ry,a:.28})}
      this._lastSkid={lx,ly,rx,ry};if(this.skidMarks.length>700)this.skidMarks.splice(0,100);
    }else this._lastSkid=null;
    // Lap tracking
    const{prog}=track.nearest(p.x,p.y);
    if(this.lastProg>=0&&this.lastProg>.85&&prog<.15){this.lapTimes.push(this.curLapTime);if(this.curLapTime<this.bestLap)this.bestLap=this.curLapTime;this.curLapTime=0;this.lap++}
    this.lastProg=prog;this.curLapTime+=dt*1000;this.raceTime+=dt*1000;
  }
}

// ────────────────────────────────────────────────────────────────
// HUD RENDERER
// ────────────────────────────────────────────────────────────────
class HUD{
  constructor(){
    this.eSp=document.getElementById('speed-val');this.eGr=document.getElementById('gear-val');
    this.eRpmV=document.getElementById('rpm-val');this.eRpmB=document.getElementById('rpm-bar');
    this.eNit=document.getElementById('nitro-bar');this.eDmg=document.getElementById('damage-bar');
    this.eLap=document.getElementById('hud-lap');this.eTim=document.getElementById('hud-time');
    this.eBst=document.getElementById('hud-best');this.ePos=document.getElementById('hud-pos');
    this.eLapN=document.getElementById('lap-notif');this.eLapT=document.getElementById('lap-notif-txt');
    this.eSC=document.getElementById('speedo-canvas');this.eSCtx=this.eSC.getContext('2d');
    this.eMMC=document.getElementById('minimap-canvas');this.eMMCtx=this.eMMC.getContext('2d');
    this._prevLap=1;this._time=0;this._mapBuf=null;this._mapSC=1;this._mapOX=0;this._mapOY=0;
  }
  initMap(track){
    const mw=this.eMMC.width,mh=this.eMMC.height,pad=16,cl=track.centerline;
    const xs=cl.map(p=>p.x),ys=cl.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const sc=Math.min((mw-pad*2)/(maxX-minX),(mh-pad*2)/(maxY-minY));
    this._mapSC=sc;this._mapOX=pad+((mw-pad*2)-(maxX-minX)*sc)/2-minX*sc;this._mapOY=pad+((mh-pad*2)-(maxY-minY)*sc)/2-minY*sc;
    const buf=document.createElement('canvas');buf.width=mw;buf.height=mh;const bc=buf.getContext('2d');
    bc.save();bc.beginPath();bc.arc(mw/2,mh/2,mw/2-1,0,Math.PI*2);bc.clip();
    bc.fillStyle='rgba(0,0,0,0.72)';bc.fillRect(0,0,mw,mh);
    bc.strokeStyle='#3a3a3a';bc.lineWidth=track.width*sc;bc.lineCap='round';bc.lineJoin='round';
    bc.beginPath();cl.forEach((p,i)=>{const mx=p.x*sc+this._mapOX,my=p.y*sc+this._mapOY;i===0?bc.moveTo(mx,my):bc.lineTo(mx,my)});bc.closePath();bc.stroke();
    bc.strokeStyle='rgba(255,255,255,0.13)';bc.lineWidth=1;bc.beginPath();cl.forEach((p,i)=>{const mx=p.x*sc+this._mapOX,my=p.y*sc+this._mapOY;i===0?bc.moveTo(mx,my):bc.lineTo(mx,my)});bc.closePath();bc.stroke();
    const sp=cl[0];bc.fillStyle='#ffe000';bc.beginPath();bc.arc(sp.x*sc+this._mapOX,sp.y*sc+this._mapOY,3,0,Math.PI*2);bc.fill();
    bc.strokeStyle='rgba(255,255,255,0.1)';bc.lineWidth=1;bc.beginPath();bc.arc(mw/2,mh/2,mw/2-1,0,Math.PI*2);bc.stroke();
    bc.restore();this._mapBuf=buf;
  }
  drawSpeedo(rn){
    const ctx=this.eSCtx,W=this.eSC.width,H=this.eSC.height,cx=W/2,cy=H/2,r=W/2-8;
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(80,80,100,0.38)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy,r-3,0,Math.PI*2);ctx.stroke();
    const sA=Math.PI*.7,eA=Math.PI*2.3,sw=eA-sA;
    ctx.strokeStyle='rgba(255,255,255,0.055)';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.arc(cx,cy,r-11,sA,eA);ctx.stroke();
    const fA=sA+sw*rn;const rc=rn<.72?`hsl(${180-rn*180/.72},100%,55%)`:rn>.88?'#ff2040':'#ff8800';
    ctx.save();ctx.shadowColor=rc;ctx.shadowBlur=10;ctx.strokeStyle=rc;ctx.lineWidth=9;ctx.beginPath();ctx.arc(cx,cy,r-11,sA,fA);ctx.stroke();ctx.restore();
    for(let ti=0;ti<=10;ti++){const a=sA+sw*(ti/10);const isM=ti%2===0,ir=isM?r-22:r-17;
      ctx.strokeStyle=isM?'rgba(255,255,255,0.48)':'rgba(255,255,255,0.18)';ctx.lineWidth=isM?2:1;
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*(r-13),cy+Math.sin(a)*(r-13));ctx.lineTo(cx+Math.cos(a)*ir,cy+Math.sin(a)*ir);ctx.stroke()}
    ctx.strokeStyle='rgba(255,30,30,0.22)';ctx.lineWidth=11;ctx.beginPath();ctx.arc(cx,cy,r-11,sA+sw*.82,eA);ctx.stroke();
  }
  drawMap(player,ais){
    const ctx=this.eMMCtx,mw=this.eMMC.width,mh=this.eMMC.height;
    ctx.clearRect(0,0,mw,mh);if(this._mapBuf)ctx.drawImage(this._mapBuf,0,0);
    const sc=this._mapSC,ox=this._mapOX,oy=this._mapOY;
    for(const c of ais){const mx=c.physics.x*sc+ox,my=c.physics.y*sc+oy;ctx.fillStyle=c.def.color;ctx.beginPath();ctx.arc(mx,my,3,0,Math.PI*2);ctx.fill()}
    const pp=player.physics,px=pp.x*sc+ox,py=pp.y*sc+oy;
    ctx.save();ctx.shadowColor='#ff2040';ctx.shadowBlur=6;ctx.fillStyle='#ff2040';
    ctx.translate(px,py);ctx.rotate(pp.heading);ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-3,-3);ctx.lineTo(-3,3);ctx.closePath();ctx.fill();ctx.restore();
  }
  showLap(lap,total,time){
    const txt=lap>total?`FINISH! ${U.formatTime(time)}`:lap===total?'FINAL LAP!':`LAP ${lap}`;
    this.eLapT.textContent=txt;this.eLapN.classList.remove('hidden');
    this.eLapN.style.animation='none';void this.eLapN.offsetWidth;this.eLapN.style.animation='';
    clearTimeout(this._lapT);this._lapT=setTimeout(()=>this.eLapN.classList.add('hidden'),1200);
  }
  update(dt,player,ais,track){
    this._time+=dt;
    const p=player.physics;
    this.eSp.textContent=Math.round(p.speedKmh);
    this.eSp.style.textShadow=p.usingNitro?'0 0 20px #00f5ff,0 0 40px #005aff':'0 0 18px rgba(255,200,0,0.75)';
    this.eGr.textContent=p.gear;
    this.eGr.style.color=p.rpmNorm>.86?'#ff6060':'#ff2040';
    this.eRpmV.textContent=Math.round(p.rpm);
    this.eRpmB.style.width=`${p.rpmNorm*100}%`;
    this.eNit.style.width=`${p.nitro*100}%`;
    this.eNit.style.boxShadow=p.usingNitro?'0 0 12px #00f5ff':'none';
    const dPct=p.damage*100;
    this.eDmg.style.width=`${dPct}%`;
    this.eDmg.style.background=dPct>60?'linear-gradient(90deg,#00ff88,#ffe000)':dPct>30?'linear-gradient(90deg,#ffe000,#ff6a00)':'linear-gradient(90deg,#ff2040,#ff6a00)';
    this.eLap.textContent=`${Math.min(player.lap,track.numLaps)}/${track.numLaps}`;
    this.eTim.textContent=U.formatTime(player.curLapTime);
    this.eBst.textContent=player.bestLap<Infinity?U.formatTime(player.bestLap):'--:--.---';
    // Position
    const all=[player,...ais];all.sort((a,b)=>{if(a.lap!==b.lap)return b.lap-a.lap;return track.nearest(b.physics.x,b.physics.y).prog-track.nearest(a.physics.x,a.physics.y).prog});
    this.ePos.textContent=U.ordinal(all.indexOf(player)+1);
    // Lap notif
    if(player.lap!==this._prevLap){this.showLap(player.lap,track.numLaps,player.lapTimes[player.lapTimes.length-1]||0);this._prevLap=player.lap}
    this.drawSpeedo(p.rpmNorm);this.drawMap(player,ais);
    if(this._time>5){const h=document.getElementById('ctrl-hint');if(h)h.style.opacity='0'}
  }
}

// ────────────────────────────────────────────────────────────────
// RACE MANAGER
// ────────────────────────────────────────────────────────────────
const RS={CD:'cd',RACE:'race',DONE:'done',PAUSE:'pause'};

class Race{
  constructor(){
    this.cv=document.getElementById('race-canvas');
    this.renderer=null;this.track=null;this.player=null;this.ais=[];
    this.parts=new Particles();this.hud=null;this.audio=new AudioEngine();
    this.loop=null;this.state=RS.CD;this.cdTimer=3.5;
    this._carDef=CAR_DEFS[0];this._circKey='alpha';this._done=false;this._keys={};this._touch={thr:0,brk:0,lft:0,rgt:0,nit:0};
    this._setupInput();
  }
  setup(def,key){this._carDef=def||CAR_DEFS[0];this._circKey=key||'alpha'}
  start(){
    this.track=new Track(this._circKey,3);this.parts=new Particles();
    const W=window.innerWidth,H=window.innerHeight;this.cv.width=W;this.cv.height=H;
    this.renderer=new Renderer(this.cv);this.renderer.bakeTrack(this.track);
    const gpos=this.track.gridPositions(5);
    this.player=new PlayerCar(this._carDef,gpos[0]);
    this.ais=[];
    const aiDefs=CAR_DEFS.filter(d=>d.id!==this._carDef.id);
    for(let i=0;i<Math.min(4,gpos.length-1);i++){this.ais.push(new AICar(aiDefs[i%aiDefs.length],gpos[i+1],.72+i*.06))}
    this.hud=new HUD();this.hud.initMap(this.track);
    this.audio.init();this.state=RS.CD;this.cdTimer=3.5;this._done=false;
    document.getElementById('countdown-overlay').classList.remove('hidden');
    document.getElementById('finish-screen').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    if(this.loop)this.loop.stop();
    this.loop=U.createLoop((dt)=>this._tick(dt));this.loop.start();
  }
  _tick(dt){
    if(this.state===RS.PAUSE)return;
    if(this.state===RS.CD){this._doCD(dt);this.renderer&&this.renderer.render(dt,this.track,this.player,this.ais,this.parts);return}
    if(this.state===RS.DONE){this.renderer&&this.renderer.render(dt,this.track,this.player,this.ais,this.parts);this.parts.update(dt);return}
    // Racing
    this._readInput();this.player.update(dt,this.track);
    const pProg=this.track.nearest(this.player.physics.x,this.player.physics.y).prog+this.player.lap;
    for(const ai of this.ais)ai.update(dt,this.track,pProg);
    this._collide();
    // Particles
    const p=this.player.physics;
    const bx=p.x-Math.cos(p.heading)*2.3,by=p.y-Math.sin(p.heading)*2.3;
    this.parts.exhaust(bx,by,p.heading,p.rpm,p.throttle);
    this.parts.tyreSmoke(p.x,p.y,Math.abs(p.slipAngle),p.wheelspin,p.speed);
    if(p.usingNitro)this.parts.nitroFlame(bx,by,p.heading,true);
    if(p.onGrass)this.parts.dust(p.x,p.y,p.speed);
    this.parts.update(dt);
    this.audio.update(p,dt);this.audio.resume();
    this.renderer.render(dt,this.track,this.player,this.ais,this.parts);
    this.hud.update(dt,this.player,this.ais,this.track);
    if(!this._done&&this.player.lap>this.track.numLaps){this._done=true;this.state=RS.DONE;setTimeout(()=>this._showFinish(),700);this.parts.celebrate(p.x,p.y)}
  }
  _doCD(dt){
    this.cdTimer-=dt;
    const ov=document.getElementById('countdown-overlay'),nm=document.getElementById('countdown-num');
    const step=this.cdTimer>2.5?'3':this.cdTimer>1.5?'2':this.cdTimer>.5?'1':'GO!';
    if(nm.textContent!==step){nm.textContent=step;nm.style.animation='none';void nm.offsetWidth;nm.style.animation='';nm.style.color=step==='GO!'?'#00ff88':'#ffe000'}
    if(this.cdTimer<=0){ov.classList.add('hidden');this.state=RS.RACE}
  }
  _readInput(){
    const k=this._keys,t=this._touch,pc=this.player;
    pc.input.throttle=(k['ArrowUp']||k['w']||k['W']||t.thr>0)?1:0;
    pc.input.brake   =(k['ArrowDown']||k['s']||k['S']||t.brk>0)?1:0;
    pc.input.left    =(k['ArrowLeft']||k['a']||k['A']||t.lft>0);
    pc.input.right   =(k['ArrowRight']||k['d']||k['D']||t.rgt>0);
    pc.input.handbrake=(k[' ']);
    pc.input.nitro   =(k['n']||k['N']||t.nit>0);
  }
  _collide(){
    const all=[this.player,...this.ais];
    for(let i=0;i<all.length;i++){
      for(let j=i+1;j<all.length;j++){
        const a=all[i].physics,b=all[j].physics;
        const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=4.4;
        if(dist<min&&dist>.01){
          const nx=dx/dist,ny=dy/dist,ov2=(min-dist)/2;
          a.x-=nx*ov2;a.y-=ny*ov2;b.x+=nx*ov2;b.y+=ny*ov2;
          const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          if(rv<0){const j2=-rv*1.4*(a.mass*b.mass/(a.mass+b.mass));a.applyImpulse(-nx,-ny,j2);b.applyImpulse(nx,ny,j2);
            const str=Math.abs(j2);if(str>180){this.parts.sparks((a.x+b.x)/2,(a.y+b.y)/2,nx,ny,str);this.renderer.cam.addShake(Math.min(str*.02,12));this.audio.collision(str)}}
        }
      }
    }
    // Wall push-back
    for(const c of all){
      const p=c.physics;if(!this.track.isOnTrack(p.x,p.y)){
        const{idx}=this.track.nearest(p.x,p.y),cl=this.track.centerline[idx];
        const tx2=cl.x-p.x,ty2=cl.y-p.y,d2=Math.hypot(tx2,ty2);
        if(d2>this.track.width*.5+2){const str=Math.max(0,d2-this.track.width*.5);p.vx+=(tx2/d2)*str*.85;p.vy+=(ty2/d2)*str*.85;p.vx*=.68;p.vy*=.68}
      }
    }
  }
  _showFinish(){
    const all=[this.player,...this.ais];
    all.sort((a,b)=>{if(a.lap!==b.lap)return b.lap-a.lap;return this.track.nearest(b.physics.x,b.physics.y).prog-this.track.nearest(a.physics.x,a.physics.y).prog});
    const pos=all.indexOf(this.player)+1;
    const st=U.load('stats',{wins:0,races:0,best:Infinity});st.races++;if(pos===1)st.wins++;if(this.player.bestLap<(st.best||Infinity))st.best=this.player.bestLap;U.save('stats',st);
    document.getElementById('finish-title').textContent=pos===1?'🏆 VICTORY!':'RACE COMPLETE';
    document.getElementById('finish-pos').textContent=U.ordinal(pos)+' Place';
    const rows=[['Race Time',U.formatTime(this.player.raceTime)],['Best Lap',U.formatTime(this.player.bestLap)],['Top Speed',`${Math.round(this.player.physics.speedKmh||0)} km/h`],['Car',this.player.def.name],['Track',this.track.name]];
    document.getElementById('finish-stats').innerHTML=rows.map(([l,v])=>`<div class="fs-row"><span class="fs-lbl">${l}</span><span class="fs-val">${v}</span></div>`).join('');
    document.getElementById('finish-screen').classList.remove('hidden');
  }
  togglePause(){
    if(this.state===RS.RACE){this.state=RS.PAUSE;document.getElementById('pause-overlay').classList.remove('hidden')}
    else if(this.state===RS.PAUSE){this.state=RS.RACE;document.getElementById('pause-overlay').classList.add('hidden');this.audio.resume()}
  }
  _setupInput(){
    window.addEventListener('keydown',e=>{
      this._keys[e.key]=true;this.audio.init();this.audio.resume();
      if(e.key==='Escape')this.togglePause();
      if((e.key==='r'||e.key==='R')&&this.state===RS.RACE)this.start();
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    });
    window.addEventListener('keyup',e=>{delete this._keys[e.key]});
    window.addEventListener('resize',()=>{if(this.renderer){const w=window.innerWidth,h=window.innerHeight;this.cv.width=w;this.cv.height=h;this.renderer.resize(w,h)}});
  }
}

// ────────────────────────────────────────────────────────────────
// MENU BACKGROUND
// ────────────────────────────────────────────────────────────────
let _menuLoop=null,_menuCanvas=null,_menuCtx=null,_menuT=0;
function initMenuBg(){
  _menuCanvas=document.getElementById('menu-canvas');if(!_menuCanvas)return;
  _menuCtx=_menuCanvas.getContext('2d');
  const resize=()=>{_menuCanvas.width=window.innerWidth;_menuCanvas.height=window.innerHeight};
  resize();window.addEventListener('resize',resize);
  const demoTrack=new Track('alpha');const demoParticles=new Particles();let demoIdx=0;
  _menuLoop=U.createLoop((dt)=>{
    _menuT+=dt;demoIdx=(demoIdx+Math.max(1,Math.floor(demoTrack.centerline.length*.0006*dt*60)))%demoTrack.centerline.length;
    const ctx=_menuCtx,W=_menuCanvas.width,H=_menuCanvas.height;
    const dp=demoTrack.centerline[demoIdx],dt2=demoTrack.tangents[demoIdx];
    const dH=Math.atan2(dt2.y,dt2.x),zoom=1.1+Math.sin(_menuT*.2)*.08;
    const ws=(wx,wy)=>({x:(wx-dp.x)*zoom+W/2,y:(wy-dp.y)*zoom+H/2});
    ctx.fillStyle='#0d180a';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#2a2a2a';ctx.lineWidth=demoTrack.width*zoom;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();demoTrack.centerline.forEach((p,i)=>{const s=ws(p.x,p.y);i===0?ctx.moveTo(s.x,s.y):ctx.lineTo(s.x,s.y)});ctx.closePath();ctx.stroke();
    ctx.strokeStyle='rgba(255,32,64,0.12)';ctx.lineWidth=1.5;ctx.setLineDash([20,16]);ctx.stroke();ctx.setLineDash([]);
    const ds=ws(dp.x,dp.y);ctx.save();ctx.shadowColor='#ff2040';ctx.shadowBlur=28;ctx.fillStyle='#ff2040';ctx.translate(ds.x,ds.y);ctx.rotate(dH);ctx.fillRect(-13,-5,26,10);ctx.restore();
    demoParticles.exhaust(dp.x-Math.cos(dH)*2,dp.y-Math.sin(dH)*2,dH,7000,.65);demoParticles.update(dt);
    demoParticles.render(ctx,{x:dp.x,y:dp.y,z:zoom,cx:W/2,cy:H/2,w:W,h:H,sx:0,sy:0});
    const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(6,7,13,0.98)');g.addColorStop(.44,'rgba(6,7,13,0.84)');g.addColorStop(.64,'rgba(6,7,13,0.48)');g.addColorStop(1,'rgba(6,7,13,0.1)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  });
  _menuLoop.start();
}
window.initMenuBg=initMenuBg;

// ────────────────────────────────────────────────────────────────
// GARAGE
// ────────────────────────────────────────────────────────────────
let _selCarIdx=0;
const _trackKeys=Object.keys(CIRCUITS);let _trackIdx=0;
function buildGarage(){
  const c=document.getElementById('garage-cars');c.innerHTML='';
  CAR_DEFS.forEach((def,idx)=>{
    const card=document.createElement('div');card.className='car-card'+(idx===_selCarIdx?' selected':'');
    card.innerHTML=`<div class="car-icon">${def.icon}</div><div class="car-name">${def.name}</div><div class="car-spd-bg"><div class="car-spd-fill" style="width:${def.stats.speed}%"></div></div><div class="car-class">${def.class}</div>`;
    card.onclick=()=>{_selCarIdx=idx;buildGarage()};c.appendChild(card);
  });
  const def=CAR_DEFS[_selCarIdx],p=document.getElementById('car-stats-panel');
  const rows=[['TOP SPEED',def.stats.speed],['HANDLING',def.stats.handling],['ACCEL',def.stats.accel],['BRAKING',def.stats.braking]];
  p.innerHTML=rows.map(([l,v])=>`<div class="csr"><div class="csr-lbl">${l}</div><div class="csr-bg"><div class="csr-fill" style="width:${v}%"></div></div><div class="csr-v">${v}</div></div>`).join('');
}
function showGarage(){if(_menuLoop)_menuLoop.stop();document.getElementById('main-menu').classList.add('hidden');document.getElementById('garage-screen').classList.remove('hidden');buildGarage()}
function hideGarage(){document.getElementById('garage-screen').classList.add('hidden');document.getElementById('main-menu').classList.remove('hidden');if(_menuLoop)_menuLoop.start()}
function garageRace(){document.getElementById('garage-screen').classList.add('hidden');startGame()}
function cycleTrack(){_trackIdx=(_trackIdx+1)%_trackKeys.length;document.getElementById('track-btn-label').textContent=`TRACK: ${CIRCUITS[_trackKeys[_trackIdx]].name.toUpperCase()}`}
function resumeGame(){if(window._race)window._race.togglePause()}
function restartRace(){document.getElementById('finish-screen').classList.add('hidden');document.getElementById('pause-overlay').classList.add('hidden');if(window._race)window._race.start()}
function backToMenu(){
  if(window._race&&window._race.loop)window._race.loop.stop();
  document.getElementById('race-screen').classList.add('hidden');document.getElementById('finish-screen').classList.add('hidden');document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');if(_menuLoop)_menuLoop.start();
  const st=U.load('stats',{wins:0,races:0,best:Infinity});
  const b=document.getElementById('stat-best'),w=document.getElementById('stat-wins'),r=document.getElementById('stat-races');
  if(b)b.textContent=st.best<Infinity?U.formatTime(st.best):'--:--.---';if(w)w.textContent=st.wins||0;if(r)r.textContent=st.races||0;
}
window.showGarage=showGarage;window.hideGarage=hideGarage;window.garageRace=garageRace;
window.cycleTrack=cycleTrack;window.resumeGame=resumeGame;window.restartRace=restartRace;window.backToMenu=backToMenu;

// ────────────────────────────────────────────────────────────────
// MAIN ENTRY + LOADER
// ────────────────────────────────────────────────────────────────
(async()=>{
  const bar=document.getElementById('loader-bar'),status=document.getElementById('loader-status'),pct=document.getElementById('loader-percent');
  const prog=(p,s)=>{bar.style.width=p+'%';status.textContent=s;pct.textContent=p+'%'};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  prog(5,'Loading assets...');await wait(190);prog(16,'Compiling shaders...');await wait(175);prog(30,'Building physics engine...');await wait(210);
  prog(46,'Generating track geometry...');await wait(240);prog(62,'Initializing AI drivers...');await wait(175);prog(76,'Warming up audio engine...');await wait(195);
  prog(88,'Rendering car models...');await wait(175);prog(96,'Calibrating tyres...');await wait(140);prog(100,'READY TO RACE!');await wait(580);
  const ls=document.getElementById('loading-screen');ls.style.transition='opacity .45s ease';ls.style.opacity='0';await wait(460);ls.style.display='none';
  document.getElementById('main-menu').classList.remove('hidden');
  initMenuBg();
  const st=U.load('stats',{wins:0,races:0,best:Infinity});
  const b=document.getElementById('stat-best'),w=document.getElementById('stat-wins'),r=document.getElementById('stat-races');
  if(b)b.textContent=st.best<Infinity?U.formatTime(st.best):'--:--.---';if(w)w.textContent=st.wins||0;if(r)r.textContent=st.races||0;
})();

function startGame(){
  if(_menuLoop)_menuLoop.stop();
  document.getElementById('main-menu').classList.add('hidden');document.getElementById('garage-screen').classList.add('hidden');
  document.getElementById('race-screen').classList.remove('hidden');
  if(!window._race)window._race=new Race();
  window._race.setup(CAR_DEFS[_selCarIdx],_trackKeys[_trackIdx]);
  window._race.start();
}
window.startGame=startGame;
