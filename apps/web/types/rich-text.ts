export interface TiptapJsonMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapJsonNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJsonNode[];
  marks?: TiptapJsonMark[];
  text?: string;
}

export interface TiptapTextDocument extends TiptapJsonNode {
  type: "doc";
}
