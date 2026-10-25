import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EvidenceUploadField } from './EvidenceUploadField';
import * as api from './api';

describe('EvidenceUploadField', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('uploads a valid PNG file and triggers onUploaded', async () => {
    const onUploaded = vi.fn();
    const onRemoved = vi.fn();

    vi.spyOn(api, 'uploadBuyerEvidence').mockResolvedValueOnce({
      evidence_id: 'ev-12345',
      media_type: 'image/png',
      byte_size: 1024,
      width: 100,
      height: 100,
    });

    await act(async () => {
      root.render(
        <EvidenceUploadField
          portalToken="token-abc"
          onUploaded={onUploaded}
          onRemoved={onRemoved}
        />,
      );
    });

    const file = new File(['fake-png-bytes'], 'screenshot.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input).not.toBeNull();

    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onUploaded).toHaveBeenCalledWith('ev-12345', 'screenshot.png');
  });

  it('rejects oversized file locally (> 5 MiB) without uploading', async () => {
    const onUploaded = vi.fn();
    const uploadSpy = vi.spyOn(api, 'uploadBuyerEvidence');

    await act(async () => {
      root.render(
        <EvidenceUploadField
          portalToken="token-abc"
          onUploaded={onUploaded}
          onRemoved={vi.fn()}
        />,
      );
    });

    const largeFile = new File([new Uint8Array(5 * 1024 * 1024 + 10)], 'huge.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    await act(async () => {
      Object.defineProperty(input, 'files', { value: [largeFile] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Image exceeds 5 MiB limit');
  });

  it('displays attached state with remove button when evidenceId is present', async () => {
    const onRemoved = vi.fn();

    await act(async () => {
      root.render(
        <EvidenceUploadField
          portalToken="token-abc"
          evidenceId="ev-12345"
          fileName="receipt.jpg"
          onUploaded={vi.fn()}
          onRemoved={onRemoved}
        />,
      );
    });

    expect(container.textContent).toContain('receipt.jpg');
    const removeBtn = container.querySelector<HTMLButtonElement>('button')!;
    expect(removeBtn).not.toBeNull();

    await act(async () => {
      removeBtn.click();
    });

    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it('displays error and keeps manual entry notice when upload fails', async () => {
    vi.spyOn(api, 'uploadBuyerEvidence').mockRejectedValueOnce(
      new Error('Storage temporarily unavailable'),
    );

    await act(async () => {
      root.render(
        <EvidenceUploadField
          portalToken="token-abc"
          onUploaded={vi.fn()}
          onRemoved={vi.fn()}
        />,
      );
    });

    const file = new File(['bytes'], 'payment.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Storage temporarily unavailable');
    expect(container.textContent).toContain('You can still submit manually below');
  });

  it('allows retrying upload with retry button after initial failure', async () => {
    const onUploaded = vi.fn();
    const uploadSpy = vi
      .spyOn(api, 'uploadBuyerEvidence')
      .mockRejectedValueOnce(new Error('Private storage service is unavailable'))
      .mockResolvedValueOnce({
        evidence_id: 'ev-retry-success',
        media_type: 'image/png',
        byte_size: 2048,
        width: 100,
        height: 100,
      });

    await act(async () => {
      root.render(
        <EvidenceUploadField
          portalToken="token-abc"
          onUploaded={onUploaded}
          onRemoved={vi.fn()}
        />,
      );
    });

    const file = new File(['png-bytes'], 'receipt.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Private storage service is unavailable');
    const retryBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Retry'),
    );
    expect(retryBtn).toBeDefined();

    await act(async () => {
      retryBtn!.click();
    });

    expect(uploadSpy).toHaveBeenCalledTimes(2);
    expect(onUploaded).toHaveBeenCalledWith('ev-retry-success', 'receipt.png');
  });
});
