import { describe, expect, it } from 'vitest';
import { defaultChoice, templateChoice } from './defaultChoice';

// Bảng 4.4 của bản vẽ G: lựa chọn chọn sẵn của hộp In.
const T = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('defaultChoice', () => {
  it('đã xác nhận, có lần in, dữ liệu KHÔNG đổi → in lại y hệt', () => {
    expect(defaultChoice({ status: 'CONFIRMED', lastPrint: { templateId: 'b', sameData: true }, templates: T, defaultTemplateId: 'a' })).toEqual({ source: 'REPRINT' });
  });
  it('đã xác nhận, có lần in, dữ liệu ĐÃ đổi → giữ cấu hình đã in (PRIOR_CONFIG)', () => {
    expect(defaultChoice({ status: 'CONFIRMED', lastPrint: { templateId: 'b', sameData: false }, templates: T, defaultTemplateId: 'a' })).toEqual({ source: 'PRIOR_CONFIG' });
  });
  it('hoàn thành cũng như đã xác nhận', () => {
    expect(defaultChoice({ status: 'COMPLETED', lastPrint: { templateId: 'b', sameData: true }, templates: T, defaultTemplateId: 'a' })).toEqual({ source: 'REPRINT' });
    expect(defaultChoice({ status: 'COMPLETED', lastPrint: { templateId: 'b', sameData: false }, templates: T, defaultTemplateId: 'a' })).toEqual({ source: 'PRIOR_CONFIG' });
  });
  it('đã xác nhận, có lần in nhưng không có bản chụp (lastPrint = null) và chưa có mẫu nào → NONE', () => {
    expect(defaultChoice({ status: 'CONFIRMED', lastPrint: null, templates: [], defaultTemplateId: null })).toEqual({ source: 'NONE' });
  });
  it('nháp có lần in → mẫu của lần in trước nếu còn dùng được', () => {
    expect(defaultChoice({ status: 'DRAFT', lastPrint: { templateId: 'c', sameData: true }, templates: T, defaultTemplateId: 'a' })).toEqual({ source: 'TEMPLATE', templateId: 'c' });
  });
  it('nháp có lần in nhưng mẫu cũ đã ngừng dùng → mẫu mặc định', () => {
    expect(defaultChoice({ status: 'DRAFT', lastPrint: { templateId: 'z', sameData: false }, templates: T, defaultTemplateId: 'b' })).toEqual({ source: 'TEMPLATE', templateId: 'b' });
  });
  it('chưa in lần nào → mẫu mặc định (kể cả khi đã xác nhận)', () => {
    expect(defaultChoice({ status: 'DRAFT', lastPrint: null, templates: T, defaultTemplateId: 'b' })).toEqual({ source: 'TEMPLATE', templateId: 'b' });
    expect(defaultChoice({ status: 'CONFIRMED', lastPrint: null, templates: T, defaultTemplateId: 'b' })).toEqual({ source: 'TEMPLATE', templateId: 'b' });
  });
  it('mặc định không nằm trong danh sách / vắng → mẫu đứng đầu (máy chủ xếp mặc định lên đầu)', () => {
    expect(templateChoice({ lastPrint: null, templates: T, defaultTemplateId: null })).toEqual({ source: 'TEMPLATE', templateId: 'a' });
    expect(templateChoice({ lastPrint: null, templates: T, defaultTemplateId: 'khong-co' })).toEqual({ source: 'TEMPLATE', templateId: 'a' });
  });
  it('không có mẫu nào → NONE', () => {
    expect(defaultChoice({ status: 'DRAFT', lastPrint: null, templates: [], defaultTemplateId: null })).toEqual({ source: 'NONE' });
  });
  it('hợp đồng đã huỷ → NONE (không in)', () => {
    expect(defaultChoice({ status: 'CANCELLED', lastPrint: { templateId: 'a', sameData: true }, templates: T, defaultTemplateId: 'a' })).toEqual({ source: 'NONE' });
  });
});
