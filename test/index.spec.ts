/*
 * @Author: zhangyang
 * @Date: 2022-09-24 15:57:54
 * @LastEditTime: 2022-12-10 11:30:13
 * @Description: 
 */
import { describe, it, expect } from 'vitest';
import { getFullYearData, isHoliday } from '../src';


describe('spider demo', () => {
  it('get holiday data', async () => {
    expect(await getFullYearData('2022')).toMatchSnapshot();
  });

  it('National Day', async () => {
    expect(await isHoliday('20221001')).toBe(true);
    expect(await isHoliday('20221002')).toBe(true);
    expect(await isHoliday('20221003')).toBe(true);
    expect(await isHoliday('20221004')).toBe(true);
    expect(await isHoliday('20221005')).toBe(true);
    expect(await isHoliday('20221006')).toBe(true);
    expect(await isHoliday('20221007')).toBe(true);

    expect(await isHoliday('20221008')).toBe(false);
    expect(await isHoliday('20221009')).toBe(false);
    expect(await isHoliday('20221010')).toBe(false);
    expect(await isHoliday('20221011')).toBe(false);
    expect(await isHoliday('20221012')).toBe(false);
    expect(await isHoliday('20221013')).toBe(false);
    expect(await isHoliday('20221014')).toBe(true);

    expect(await isHoliday('20221015')).toBe(true);
    expect(await isHoliday('20221016')).toBe(true);
    
    expect(await isHoliday('20221028')).toBe(true);

  });

  it('2023', async () => {
    expect(await getFullYearData('2023')).toMatchSnapshot();
  });
});