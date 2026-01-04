/**
 * Tests for modal.js - Modal dialog functionality
 */

import { showModal, closeModal, showErrorModal, showInfoModal } from './modal.js';

describe('showModal', () => {
  test('showModal is a function', () => {
    expect(typeof showModal).toBe('function');
  });

  test('showModal sets the modal title', () => {
    showModal('Test Title', '<p>Content</p>');

    const modalTitle = document.getElementById('modal-title');
    expect(modalTitle.textContent).toBe('Test Title');
  });

  test('showModal sets the modal content', () => {
    showModal('Title', '<p>Test Content</p>');

    const modalContent = document.getElementById('modal-content');
    expect(modalContent.innerHTML).toBe('<p>Test Content</p>');
  });

  test('showModal adds active class to overlay', () => {
    showModal('Title', 'Content');

    const modalOverlay = document.getElementById('modal-overlay');
    expect(modalOverlay.classList.contains('active')).toBe(true);
  });

  test('showModal prevents body scroll', () => {
    showModal('Title', 'Content');

    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('closeModal', () => {
  test('closeModal is a function', () => {
    expect(typeof closeModal).toBe('function');
  });

  test('closeModal removes active class from overlay', () => {
    // First show the modal
    showModal('Title', 'Content');

    // Then close it
    closeModal();

    const modalOverlay = document.getElementById('modal-overlay');
    expect(modalOverlay.classList.contains('active')).toBe(false);
  });

  test('closeModal restores body scroll', () => {
    // First show the modal (which sets overflow to hidden)
    showModal('Title', 'Content');
    expect(document.body.style.overflow).toBe('hidden');

    // Then close it
    closeModal();

    expect(document.body.style.overflow).toBe('');
  });
});

describe('showErrorModal', () => {
  test('showErrorModal is a function', () => {
    expect(typeof showErrorModal).toBe('function');
  });

  test('showErrorModal displays error message', () => {
    showErrorModal('Error Title', 'Error message');

    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    expect(modalTitle.textContent).toBe('Error Title');
    expect(modalContent.innerHTML).toContain('Error message');
  });

  test('showErrorModal uses error styling class', () => {
    showErrorModal('Error', 'Message');

    const modalContent = document.getElementById('modal-content');
    expect(modalContent.innerHTML).toContain('modal-error-message');
  });

  test('showErrorModal escapes HTML in message', () => {
    showErrorModal('Error', '<script>alert("xss")</script>');

    const modalContent = document.getElementById('modal-content');
    // Should not contain actual script tags
    expect(modalContent.innerHTML).not.toContain('<script>');
    // Should contain escaped content
    expect(modalContent.innerHTML).toContain('&lt;script&gt;');
  });
});

describe('showInfoModal', () => {
  test('showInfoModal is a function', () => {
    expect(typeof showInfoModal).toBe('function');
  });

  test('showInfoModal displays info message', () => {
    showInfoModal('Info Title', 'Info message');

    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    expect(modalTitle.textContent).toBe('Info Title');
    expect(modalContent.innerHTML).toContain('Info message');
  });

  test('showInfoModal uses info styling class', () => {
    showInfoModal('Info', 'Message');

    const modalContent = document.getElementById('modal-content');
    expect(modalContent.innerHTML).toContain('modal-info-message');
  });

  test('showInfoModal escapes HTML in message', () => {
    showInfoModal('Info', '<img src=x onerror="alert(1)">');

    const modalContent = document.getElementById('modal-content');
    // Should not contain actual img tag that could trigger onerror
    expect(modalContent.innerHTML).not.toContain('<img');
  });
});

describe('XSS prevention', () => {
  test('escapeHtml prevents script injection', () => {
    showErrorModal('Test', '<script>document.cookie</script>');

    const modalContent = document.getElementById('modal-content');
    expect(modalContent.innerHTML).not.toContain('<script>');
  });

  test('escapeHtml handles special characters', () => {
    showErrorModal('Test', '< > & " \'');

    const modalContent = document.getElementById('modal-content');
    expect(modalContent.innerHTML).toContain('&lt;');
    expect(modalContent.innerHTML).toContain('&gt;');
    expect(modalContent.innerHTML).toContain('&amp;');
  });
});
