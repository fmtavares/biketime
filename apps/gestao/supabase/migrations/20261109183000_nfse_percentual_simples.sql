-- Percentual aproximado da alíquota do Simples (pTotTribSN) na NFS-e nacional.
alter table public.nfse_settings
  add column if not exists percentual_simples numeric(5, 2);

comment on column public.nfse_settings.percentual_simples is
  'Percentual aproximado dos tributos da alíquota do Simples Nacional, informado na NFS-e nacional (pTotTribSN).';
