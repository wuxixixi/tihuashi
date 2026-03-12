import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App 组件', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('alert', vi.fn());
  });

  it('渲染标题与副标题', () => {
    render(<App />);
    expect(screen.getByText('墨韵 AI')).toBeInTheDocument();
    expect(screen.getByText('AI 赏析中国画，为您题诗')).toBeInTheDocument();
  });

  it('默认显示创作 tab 与上传区域', () => {
    render(<App />);
    expect(screen.getByText('上传画作')).toBeInTheDocument();
    expect(screen.getByText('点击或拖拽上传中国画')).toBeInTheDocument();
    expect(screen.getByText('创作')).toBeInTheDocument();
    expect(screen.getByText('历史记录')).toBeInTheDocument();
  });

  it('创作 tab 下显示感悟输入与诗/词风格选项', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/请写下您对这幅画的理解和感受/)).toBeInTheDocument();
    expect(screen.getByText('诗')).toBeInTheDocument();
    expect(screen.getByText('词')).toBeInTheDocument();
    expect(screen.getByText('五言绝句')).toBeInTheDocument();
    expect(screen.getByText('婉约')).toBeInTheDocument();
  });

  it('点击历史记录 tab 会请求 /api/history', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      json: async () => ({ success: true, history: [] }),
    });
    render(<App />);
    await user.click(screen.getByText('历史记录'));
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/history');
  });

  it('历史记录为空时显示暂无记录', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      json: async () => ({ success: true, history: [] }),
    });
    render(<App />);
    await user.click(screen.getByText('历史记录'));
    expect(await screen.findByText('暂无记录')).toBeInTheDocument();
  });

  it('选择风格后对应按钮有 active 样式', async () => {
    const user = userEvent.setup();
    render(<App />);
    const btn = screen.getByText('婉约');
    await user.click(btn);
    expect(btn).toHaveClass('active');
  });

  it('输入感悟后文本框显示对应内容', async () => {
    const user = userEvent.setup();
    render(<App />);
    const textarea = screen.getByPlaceholderText(/请写下您对这幅画的理解和感受/);
    await user.type(textarea, '我的感悟');
    expect(textarea).toHaveValue('我的感悟');
  });

  it('无赏析时点击为画题诗应 alert 提示', async () => {
    const user = userEvent.setup();
    render(<App />);
    const poemBtn = screen.getByRole('button', { name: /为画题诗/ });
    await user.click(poemBtn);
    expect(alert).toHaveBeenCalledWith('请先上传图片并等待AI赏析完成');
  });

  it('有赏析时点击为画题诗会请求 /api/poem', async () => {
    const user = userEvent.setup();
    fetch
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            success: true,
            url: '/uploads/1.jpg',
            fullPath: '/uploads/1.jpg',
          }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, analysis: 'AI 赏析内容' }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, title: '题画诗', poem: '生成的诗词' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, history: [] }),
      });
    render(<App />);
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);
    await screen.findByText('AI 赏析内容');
    const poemBtn = screen.getByRole('button', { name: /为画题诗/ });
    await user.click(poemBtn);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/poem',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});
