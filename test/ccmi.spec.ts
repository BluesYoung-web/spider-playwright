/*
 * @Author: zhangyang
 * @Date: 2024-07-11 17:40:33
 * @LastEditTime: 2024-07-11 17:41:59
 * @Description: 
 */
import { describe, it, expect } from 'vitest';
import { spiderCcmihb } from '../src';


describe('spider ccmihb', () => {
  it('generate json', async () => {
    expect(await spiderCcmihb()).toBeUndefined()
  })
})