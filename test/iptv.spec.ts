/*
 * @Author: zhangyang
 * @Date: 2023-11-26 17:00:30
 * @LastEditTime: 2023-12-17 17:12:52
 * @Description: 
 */
import { downloadFromOthers, generateIPTVSrc } from '../src'

import { describe, it, expect } from 'vitest';


describe('generateIPTVSrc', () => {
  it('download from others', async () => {
    expect(await downloadFromOthers()).toBeDefined()
  })

  it.todo('todo: https://epg.pw/test_channels.m3u')


  it('generateIPTVSrc', async () => {
    expect(await generateIPTVSrc()).toBeDefined()
  })
})