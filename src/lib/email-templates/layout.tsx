import * as React from 'react'
import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'

/** Moldura comum dos e-mails de acesso: identidade azul-marinho e dourado, fundo branco. */
export function Shell({ preview, title, children }: { preview: string; title: string; children: React.ReactNode }) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={band}><Text style={brand}>Gestão Jurídica e Financeira</Text></Section>
          <Section style={content}>
            <Text style={h1}>{title}</Text>
            {children}
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Gestão Jurídica e Financeira<br />Uma solução da RTG Systems.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const P = ({ children }: { children: React.ReactNode }) => <Text style={text}>{children}</Text>
export const Small = ({ children }: { children: React.ReactNode }) => <Text style={small}>{children}</Text>
export const Cta = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Section style={{ margin: '8px 0 24px' }}><Button style={button} href={href}>{children}</Button></Section>
)
export const Code = ({ children }: { children: React.ReactNode }) => <Text style={code}>{children}</Text>

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' }
const container = { maxWidth: '560px', margin: '0 auto', border: '1px solid #E3E7EC', borderRadius: '8px', overflow: 'hidden' as const }
const band = { backgroundColor: '#0B1B31', padding: '18px 28px', borderBottom: '3px solid #D6BC7A' }
const brand = { color: '#D6BC7A', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const, margin: 0, fontWeight: 'bold' as const }
const content = { padding: '28px 28px 8px' }
const h1 = { fontSize: '21px', fontWeight: 'bold' as const, color: '#0B1B31', margin: '0 0 18px' }
const text = { fontSize: '14px', color: '#33404F', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#647184', lineHeight: '1.5', margin: '0 0 12px' }
const button = { backgroundColor: '#0B1B31', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '6px', padding: '13px 22px', textDecoration: 'none', border: '1px solid #D6BC7A' }
const code = { fontSize: '24px', letterSpacing: '6px', fontWeight: 'bold' as const, color: '#0B1B31', margin: '0 0 20px' }
const hr = { borderColor: '#E3E7EC', margin: '8px 0 0' }
const footer = { fontSize: '11px', color: '#647184', lineHeight: '1.5', padding: '14px 28px 20px', margin: 0 }
