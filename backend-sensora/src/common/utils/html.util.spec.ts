import { escaparHtml } from './html.util';

describe('escaparHtml', () => {
  it('escapa os caracteres especiais do HTML', () => {
    expect(escaparHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });

  it('mantém texto comum (inclusive acentos) como está', () => {
    expect(escaparHtml('Vela de Lavanda — não chegou')).toBe(
      'Vela de Lavanda — não chegou',
    );
  });
});
