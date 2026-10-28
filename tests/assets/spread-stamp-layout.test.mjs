import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSpreadStampHome, getSpreadStampFocus } from '../../src/features/spread/stampLayout.js';

test('三种地域票幅在桌面余宽内完整排列且聚焦大于原票，随机角度稳定', () => {
  for (const [width, height] of [[320,470], [500,550], [730,757], [920,900]]) {
    for (const ratio of [45/65,60/45,40/75]) {
      const angles = new Set();
      for (let index=0; index<4; index++) {
        const stamp = { id:`stamp-${index}`, number:String(index+1), ratio };
        const home = getSpreadStampHome(stamp,width,height);
        assert.deepEqual(home,getSpreadStampHome(stamp,width,height));
        const radians=Math.abs(home.angle)*Math.PI/180;
        const halfX=(Math.cos(radians)*home.width+Math.sin(radians)*home.height)/2;
        const halfY=(Math.cos(radians)*home.height+Math.sin(radians)*home.width)/2;
        assert.ok(home.x-halfX>=0 && home.x+halfX<=width,`horizontal ${width}/${ratio}`);
        assert.ok(home.y-halfY>=0 && home.y+halfY<=height-20,`vertical ${height}/${ratio}`);
        assert.ok(Math.abs(home.width/home.height-ratio)<1e-10);
        assert.ok(Math.abs(home.angle)>1 && Math.abs(home.angle)<6);
        angles.add(home.angle);
        const focus=getSpreadStampFocus(stamp,width,height);
        assert.ok(focus.width>home.width && focus.height>home.height);
        assert.ok(focus.x-focus.width/2>=0 && focus.x+focus.width/2<=width);
        assert.ok(focus.y-focus.height/2>=0 && focus.y+focus.height/2<=height);
      }
      assert.equal(angles.size,4);
    }
  }
});
