import { mergeAttributes, Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import QRCode from 'qrcode';

export const BallotOption = Node.create({
  name: 'ballotOption',
  group: 'block',
  content: 'inline*',
  defining: true,
  draggable: true,
  addAttributes: () => ({
    style: { default: 'fill' },
  }),
  parseHTML: () => [
    {
      tag: 'div[data-ballot-option]',
      getAttrs: el => ({ style: el.getAttribute('data-style') || 'check' }),
    },
  ],
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-ballot-option': '', 'data-style': HTMLAttributes.style, 'class': 'ballot-option' }),
      [
        'span',
        { 'class': 'option-box', 'contenteditable': 'false', 'aria-hidden': 'true' },
      ],
      [
        'div',
        { class: 'option-text' },
        0,
      ],
    ];
  },
  addKeyboardShortcuts() {
    return {
      'Enter': () => this.editor.commands.splitBlock(),
      'Mod-Shift-7': () => this.editor.commands.toggleNode('ballotOption', 'paragraph'),
    };
  },
});

export const BallotNumber = Node.create({
  name: 'ballotNumber',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    kind: { default: 'serial' },
  }),
  parseHTML: () => [
    {
      tag: 'span[data-ballot-number]',
      getAttrs: element => ({
        kind: element.getAttribute('data-ballot-number'),
      }),
    },
  ],
  renderHTML({ node }) {
    return [
      'span',
      { 'data-ballot-number': node.attrs.kind, 'class': 'ballot-number', 'contenteditable': 'false' },
      node.attrs.kind === 'serial'
        ? '000001'
        : '000000000000',
    ];
  },
});

export const BallotQr = Node.create({
  name: 'ballotQr',
  group: 'block',
  atom: true,
  draggable: true,
  parseHTML: () => [
    { tag: 'div[data-ballot-qr]' },
  ],
  renderHTML: () => [
    'div',
    { 'data-ballot-qr': '', 'class': 'ballot-qr' },
    '二维码',
  ],
  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.className = 'ballot-qr';
      dom.contentEditable = 'false';
      const image = document.createElement('img');
      image.alt = '选票二维码占位，导出时替换为真实编号';
      image.width = 96;
      image.height = 96;
      dom.append(image);
      void QRCode.toDataURL('Make Vote · 选票二维码预览', { width: 144, margin: 4 }).then((url) => {
        image.src = url;
      });
      return { dom };
    };
  },
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  draggable: true,
  parseHTML: () => [
    { tag: 'div[data-page-break]' },
  ],
  renderHTML: () => [
    'div',
    { 'data-page-break': '', 'class': 'page-break' },
  ],
});

export const HttpsImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => ({ src: attributes.src }),
      },
    };
  },
});

// Only public, MIT-licensed Tiptap packages. No Pro registry or services.
export function ballotExtensions() {
  return [
    StarterKit.configure({
      link: { openOnClick: false },
      heading: {
        levels: [1, 2, 3],
      },
    }),
    HttpsImage.configure({ inline: false, allowBase64: false }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    TextStyle,
    FontSize,
    TableKit.configure({
      table: { resizable: true },
    }),
    Markdown,
    BallotOption,
    BallotNumber,
    BallotQr,
    PageBreak,
  ];
}
