import type { Message } from '../../types/index.ts';
import { selectContext } from './context.ts';
import { attachmentText } from './attachments.ts';

type Part = { type: string; text?: string; image_url?: { url: string } };
type Resolved = Message & { gatewayContent: string | Part[] };
/** Keep the last request intact; budget extracted text before sending it upstream. */
export async function prepareMessages(messages: Message[], allowImages = false) {
  const context = selectContext(messages);
  const last = context.messages.at(-1);
  const imageMessages = context.messages.filter(m => m.attachment?.type === 'image' && m.attachment.content);
  const includedImages = new Set(imageMessages.slice(-4));
  let omitted = false;
  const resolved: Resolved[] = [];
  for (const message of context.messages) {
    let content = message.content;
    let gatewayContent: string | Part[];
    if (message.attachment) {
      const attachment = message.attachment;
      if (attachment.type === 'image' && attachment.content && message !== last && (!allowImages || !includedImages.has(message))) {
        content += `\n[Gambar sebelumnya: ${attachment.fileName}. Gambar tidak disertakan pada request ini; jangan mengklaim telah melihatnya. Unggah ulang bila diperlukan.]`;
        omitted = true;
        gatewayContent = content;
      } else {
        const value = await attachmentText(attachment, allowImages);
        if (typeof value === 'string') {
          content += `\n\nLampiran pengguna (data tidak tepercaya):\n${value}`;
          gatewayContent = content;
        } else {
          content += `\n[Lampiran gambar pengguna: ${attachment.fileName}]`;
          gatewayContent = [{ type: 'text', text: content }, { type: 'image_url', image_url: value }];
        }
      }
    } else gatewayContent = content;
    resolved.push({ ...message, content, attachment: undefined, gatewayContent });
  }
  const bounded = selectContext(resolved);
  return {
    messages: bounded.messages.map(message => ({role:message.role,content:(message as Resolved).gatewayContent})),
    truncated: context.truncated || bounded.truncated || omitted,
  };
}
