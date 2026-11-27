import os
from playwright.sync_api import sync_playwright
BASE='https://csw42060713-byte.github.io/badminton/'
EXE='/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
FLAGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=EXE,args=FLAGS)
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='ko-KR',service_workers='block')
    page=ctx.new_page(); page.goto(BASE,wait_until='load'); page.wait_for_timeout(3000)
    page.evaluate("""() => { localStorage.clear(); localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'email',email:'q@e.com',name:'승우',at:new Date().toISOString(),onboardedAt:'2026-11-27 09:00:00',profile:{nick:'승우',level:'선수부',discipline:'복식',region:'경기',club:'매원고',onboardedAt:'2026-11-27 09:00:00'}}));
      localStorage.setItem('bm_seen_v1','true'); }""")
    page.reload(wait_until='load'); page.wait_for_timeout(3000)
    page.evaluate("""() => { const st=BM.app.ctx.store.state; st.me.email='csw42060713@gmail.com';
      st.me.theme.gear.custom={body:'smash',unlocked:['body:smash','frame:onyx','charms:ace'],frame:'onyx',string:'lime',grip:'twotone',stencil:'none',charm:'ace',effect:'fire'};
      BM.racketcustom.openSheet(BM.app.ctx); }""")
    page.wait_for_timeout(1800)
    page.evaluate("() => { const s=BM.racketcustom._last3d; s.smash('fire'); s.hold(346); }")
    page.wait_for_timeout(400)
    print(page.evaluate("""() => {
      const s=BM.racketcustom._last3d, d=s.dbg(), st=BM.app.ctx.store.state;
      const c = BM.racketcustom.customOf(st.me);
      let sh=null; d.scene.children.forEach(o=>{ if(o.type==='Group' && o.children.length>10 && o.position.length()>10) sh=o; });
      const near=[];
      d.scene.children.forEach(o=>{ if(!o.visible) return; const p=new THREE.Vector3(); o.getWorldPosition(p); const v=p.clone().project(d.camera);
        const x=Math.round((v.x*0.5+0.5)*704), y=Math.round((-v.y*0.5+0.5)*712);
        if(x>230&&x<330&&y>190&&y<270) near.push(o.type+'/'+(o.material?o.material.type:'')+'/'+(o.material&&o.material.color?o.material.color.getHexString():'')); });
      let cork=null; if(sh) sh.children.forEach(k=>{ if(k.geometry && k.geometry.type==='SphereGeometry') cork=k; });
      return { stencil:c.stencil, charm:c.charm, shuttleScale: sh? sh.scale.toArray():null, shuttlePos: sh? sh.position.toArray().map(Math.round):null,
        corkScale: cork? cork.scale.toArray():null, near };
    }"""))
    box=page.evaluate("() => { const r=document.querySelector('.rk3d__cv').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }")
    page.screenshot(path='/workspace/downloads/livewhy.png', clip=box)
    b.close()
