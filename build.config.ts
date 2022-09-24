/*
 * @Author: zhangyang
 * @Date: 2022-09-24 18:22:25
 * @LastEditTime: 2022-09-24 18:27:26
 * @Description: 
 */
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    'src/index'
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
});
