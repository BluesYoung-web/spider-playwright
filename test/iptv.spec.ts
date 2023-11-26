/*
 * @Author: zhangyang
 * @Date: 2023-11-26 17:00:30
 * @LastEditTime: 2023-11-26 18:39:00
 * @Description: 
 */
import { generateIPTVSrc } from '../src'

import { describe, it, expect } from 'vitest';


describe('generateIPTVSrc', () => {
  it('generateIPTVSrc', async () => {
    expect(await generateIPTVSrc()).toBeDefined()
  })
})