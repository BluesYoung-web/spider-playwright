/*
 * @Author: zhangyang
 * @Date: 2023-11-26 17:00:30
 * @LastEditTime: 2025-01-22 17:36:37
 * @Description: 
 */
import { downloadFrom_wwb521_live, downloadFromEpg, downloadFromOthers, generateIPTVSrc } from '../src'

import { describe, it, expect } from 'vitest';


describe('generateIPTVSrc', () => {
  it('download from others', async () => {
    expect(await downloadFromOthers()).toBeDefined()
  })

  it('download from: https://epg.pw/test_channels.m3u', async () => {
    expect(await downloadFromEpg()).toBeDefined()
  })


  it.skip('generateIPTVSrc', async () => {
    expect(await generateIPTVSrc()).toBeDefined()
  })

  it('download from wwb521', async () => {
    expect(await downloadFrom_wwb521_live()).toBeDefined()
  })
})