import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';

function renderApp() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('App 组件', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('alert', vi.fn());
    // jsdom may not have full localStorage; stub if needed
    if (typeof localStorage !== 'undefined' && localStorage.clear) {
      localStorage.clear();
    } else {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      });
    }
  });

  it('渲染标题与副标题', () => {
    renderApp();
    expect(screen.getByText('墨韵 AI')).toBeInTheDocument();
    expect(screen.getByText('AI 赏析中国画，为您题诗')).toBeInTheDocument();
  });

  it('默认显示创作 tab 和空状态引导', () => {
    renderApp();
    expect(screen.getByText('创作')).toBeInTheDocument();
    expect(screen.getByText('历史记录')).toBeInTheDocument();
    expect(screen.getByText('欢迎来到墨韵 AI')).toBeInTheDocument();
  });

  it('点击开始创作按钮后显示上传区域', async () => {
    const user = userEvent.setup();
    renderApp();
    const startBtn = screen.getByText('开始创作');
    await user.click(startBtn);
    expect(screen.getByText('上传画作')).toBeInTheDocument();
    expect(screen.getByText(/点击或拖拽上传中国画/)).toBeInTheDocument();
  });

  it('点击历史记录 tab 会请求 /api/history', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce({
      json: async () => ({ success: true, history: [], pagination: { total: 0, totalPages: 1, page: 1, pageSize: 12 } }),
    });
    renderApp();
    await user.click(screen.getByText('历史记录'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/history'));
  });

  it('显示主题切换按钮', () => {
    renderApp();
    expect(screen.getByText('古典棕')).toBeInTheDocument();
    expect(screen.getByText('水墨黑')).toBeInTheDocument();
    expect(screen.getByText('青花蓝')).toBeInTheDocument();
  });

  it('切换主题后按钮显示 active', async () => {
    const user = userEvent.setup();
    renderApp();
    const inkBtn = screen.getByText('水墨黑').closest('button');
    await user.click(inkBtn);
    expect(inkBtn).toHaveClass('active');
  });

  it('显示快捷键提示', () => {
    renderApp();
    expect(screen.getByText(/Ctrl\+Enter/)).toBeInTheDocument();
  });
});
