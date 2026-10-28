import test from 'node:test';
import assert from 'node:assert/strict';
import { envelopeFrame, sceneProgress } from '../web/src/lib/animation.js';
test('closed flap covers pocket; open flap stays upright',()=>{
 assert.equal(envelopeFrame(0,500,450).angle,-180);
 assert.equal(envelopeFrame(1,500,450).angle,0);
 assert.equal(envelopeFrame(1,500,450).layer,1);
});
test('paper waits for fully opened hinge and reverses in the same order',()=>{
 for(const p of [0,.1,.2,.3,.4]) assert.equal(envelopeFrame(p,500,450).paperY,504);
 assert(envelopeFrame(.7,500,450).paperY<504);
 assert.equal(envelopeFrame(1,500,450).paperY,-243);
});
test('paper clearance grows with content and respects responsive geometry',()=>{
 for(const [paper,stage] of [[500,450],[650,400],[530,600]]){
 const f=envelopeFrame(1,paper,stage);
 assert(f.clearance>=paper-stage*.42+28);
 }
});
test('scroll is based on sticky stage, bounded independently of innerHeight',()=>{
 assert.equal(sceneProgress(70,1100,620,70),0);
 assert.equal(sceneProgress(-170,1100,620,70),.5);
 assert.equal(sceneProgress(-900,1100,620,70),1);
 assert.equal(sceneProgress(0,500,620,70),0);
});

test('original doll motion enlarges and moves upwards, not down', async()=>{
 const {heroGeometry,heroFrame}=await import('../web/src/lib/animation.js');
 for(const scene of [
  {stageWidth:390,stageHeight:620,artWidth:237,artHeight:340,artTop:161,logoHeight:115,mobile:true},
  {stageWidth:1440,stageHeight:760,artWidth:219,artHeight:314,artTop:364,logoHeight:310,mobile:false},
 ]){
  const geometry=heroGeometry(scene),start=heroFrame(0,geometry),mid=heroFrame(.5,geometry),end=heroFrame(1,geometry);
  assert.equal(start.scale,1.1);assert.equal(start.y,0);
  assert(end.scale>start.scale);assert(mid.scale>start.scale&&mid.scale<end.scale);
  assert(end.y<mid.y&&mid.y<0);
  assert(scene.artTop+end.y>=42-0.01);
  assert(scene.artTop+end.y+scene.artHeight*end.scale<=scene.stageHeight-48+0.01);
  assert(scene.artTop+end.y<scene.artTop-8); // overlaps the logo above it
 }
});
