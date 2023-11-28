/*
 * @Author: zhangyang
 * @Date: 2022-09-24 15:57:54
 * @LastEditTime: 2023-11-28 14:50:06
 * @Description: 
 */
import { describe, it, expect } from 'vitest';
import { getFullYearData } from '../src';


describe('generate holiday', () => {
  it('generate holiday.json', async () => {
    expect(await getFullYearData()).toBeDefined()
  })
})