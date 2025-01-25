/*
 * @Author: zhangyang
 * @Date: 2023-11-26 17:00:30
 * @LastEditTime: 2025-01-25 17:03:16
 * @Description: 
 */
import { downloadFrom_wwb521_live, downloadFrom_yue365_iptv, downloadFrom_zwc456baby, downloadFromEpg, downloadFromOthers, generateIPTVSrc } from '../src'

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

  it('download from yue365', async () => {
    expect(await downloadFrom_yue365_iptv()).toBeDefined()
  })

  it('download from zwc456baby', async () => {
    expect(await downloadFrom_zwc456baby()).toBeDefined()
  })
})