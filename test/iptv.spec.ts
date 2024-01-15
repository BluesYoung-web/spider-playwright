/*
 * @Author: zhangyang
 * @Date: 2023-11-26 17:00:30
 * @LastEditTime: 2024-01-15 14:45:52
 * @Description: 
 */
import { downloadFromEpg, downloadFromOthers, generateIPTVSrc } from '../src'

import { describe, it, expect } from 'vitest';


describe('generateIPTVSrc', () => {
  it('download from others', async () => {
    expect(await downloadFromOthers()).toBeDefined()
  })

  it('download from: https://epg.pw/test_channels.m3u', async () => {
    expect(await downloadFromEpg()).toBeDefined()
  })


  it('generateIPTVSrc', async () => {
    expect(await generateIPTVSrc()).toBeDefined()
  })
})