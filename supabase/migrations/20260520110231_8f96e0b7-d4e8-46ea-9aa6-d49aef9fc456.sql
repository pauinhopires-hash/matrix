-- =========================================================
-- 1. user_status: adicionar 'active'
-- =========================================================
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'active';

-- =========================================================
-- 2. Coluna 'ativo' em locais, sublocais, categorias, subcategorias
-- =========================================================
ALTER TABLE public.locais        ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.sublocais     ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.categorias    ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.subcategorias ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- =========================================================
-- 3. requisicoes.foto_url
-- =========================================================
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS foto_url text;

-- =========================================================
-- 4. setores
-- =========================================================
CREATE TABLE IF NOT EXISTS public.setores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  ordem       integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "setores read"        ON public.setores;
DROP POLICY IF EXISTS "setores staff write" ON public.setores;
CREATE POLICY "setores read"        ON public.setores FOR SELECT TO authenticated USING (true);
CREATE POLICY "setores staff write" ON public.setores FOR ALL    TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

INSERT INTO public.setores (nome, ordem) VALUES
  ('Salão Principal', 0),
  ('Salão dos Fundos', 1),
  ('Área Aberta', 2),
  ('Frente', 3),
  ('Salão de Eventos', 4),
  ('Cozinha', 5),
  ('Bar', 6),
  ('Caixa', 7),
  ('Atendimento', 8),
  ('Salão', 9),
  ('Geral', 10)
ON CONFLICT (nome) DO NOTHING;

-- =========================================================
-- 5. checklist_tipo enum + checklist_itens
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.checklist_tipo AS ENUM ('abertura','meio','fechamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.checklist_itens (
  id         text PRIMARY KEY,
  tipo       public.checklist_tipo NOT NULL,
  setor      text NOT NULL,
  label      text NOT NULL,
  ordem      integer NOT NULL DEFAULT 0,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checklist_itens_tipo_ordem_idx ON public.checklist_itens (tipo, ordem);

DROP TRIGGER IF EXISTS checklist_itens_touch ON public.checklist_itens;
CREATE TRIGGER checklist_itens_touch BEFORE UPDATE ON public.checklist_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklist_itens read"        ON public.checklist_itens;
DROP POLICY IF EXISTS "checklist_itens staff write" ON public.checklist_itens;
CREATE POLICY "checklist_itens read"        ON public.checklist_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_itens staff write" ON public.checklist_itens FOR ALL    TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- Seed inicial dos itens (abertura/meio/fechamento)
INSERT INTO public.checklist_itens (id, tipo, setor, label, ordem) VALUES
  ('ab-sp-1','abertura','Salão Principal','Arrumar as mesas',0),
  ('ab-sp-2','abertura','Salão Principal','Verificar, limpar e repor azeites',1),
  ('ab-sp-3','abertura','Salão Principal','Embalar talheres',2),
  ('ab-sp-4','abertura','Salão Principal','Dobrar guardanapos',3),
  ('ab-sp-5','abertura','Salão Principal','Conferir, limpar cadeiras e assentos',4),
  ('ab-sp-6','abertura','Salão Principal','Conferir e limpar maçanetas e vidros',5),
  ('ab-sp-7','abertura','Salão Principal','Conferir copos e pratos',6),
  ('ab-sp-8','abertura','Salão Principal','Passar pano no chão, cadeiras e mesas',7),
  ('ab-sp-9','abertura','Salão Principal','Ligar luz, rádio e ventiladores/ar',8),
  ('ab-sp-10','abertura','Salão Principal','Organizar gelo',9),
  ('ab-sf-1','abertura','Salão dos Fundos','Embalar talheres',10),
  ('ab-sf-2','abertura','Salão dos Fundos','Dobrar guardanapos',11),
  ('ab-sf-3','abertura','Salão dos Fundos','Conferir, limpar cadeiras e assentos',12),
  ('ab-sf-4','abertura','Salão dos Fundos','Conferir e limpar maçaneta e vidros',13),
  ('ab-sf-5','abertura','Salão dos Fundos','Conferir copos e pratos',14),
  ('ab-sf-6','abertura','Salão dos Fundos','Passar pano no chão, cadeiras e mesas',15),
  ('ab-sf-7','abertura','Salão dos Fundos','Ligar luz, rádio e ventiladores/ar',16),
  ('ab-sf-8','abertura','Salão dos Fundos','Organizar gelo',17),
  ('ab-ab-1','abertura','Área Aberta','Varrer folhagens',18),
  ('ab-ab-2','abertura','Área Aberta','Embalar talheres',19),
  ('ab-ab-3','abertura','Área Aberta','Dobrar guardanapos',20),
  ('ab-ab-4','abertura','Área Aberta','Conferir, limpar cadeiras e assentos',21),
  ('ab-ab-5','abertura','Área Aberta','Conferir e limpar maçaneta e vidros',22),
  ('ab-ab-6','abertura','Área Aberta','Conferir copos e pratos',23),
  ('ab-ab-7','abertura','Área Aberta','Passar pano no chão, cadeiras e mesas',24),
  ('ab-ab-8','abertura','Área Aberta','Ligar luz, rádio e ventiladores/ar',25),
  ('ab-ab-9','abertura','Área Aberta','Organizar gelo',26),
  ('ab-ab-10','abertura','Área Aberta','Jogar água nas plantas',27),
  ('ab-fr-1','abertura','Frente','Varrer folhagens',28),
  ('ab-fr-2','abertura','Frente','Embalar talheres',29),
  ('ab-fr-3','abertura','Frente','Dobrar guardanapos',30),
  ('ab-fr-4','abertura','Frente','Conferir, limpar cadeiras e assentos',31),
  ('ab-fr-5','abertura','Frente','Conferir e limpar maçaneta e vidros',32),
  ('ab-fr-6','abertura','Frente','Conferir copos e pratos',33),
  ('ab-fr-7','abertura','Frente','Passar pano no chão, cadeiras e mesas',34),
  ('ab-fr-8','abertura','Frente','Ligar luz, rádio e ventiladores/ar',35),
  ('ab-fr-9','abertura','Frente','Organizar gelo',36),
  ('ab-fr-10','abertura','Frente','Ligar letreiro 18h',37),
  ('ab-coz-1','abertura','Cozinha','Verificar validade',38),
  ('ab-coz-2','abertura','Cozinha','Verificar temperatura dos equipamentos',39),
  ('ab-coz-3','abertura','Cozinha','Organizar bancada',40),
  ('ab-coz-4','abertura','Cozinha','Verificar estoque crítico',41),
  ('ab-coz-5','abertura','Cozinha','Conferir produção do dia',42),
  ('ab-coz-6','abertura','Cozinha','Separar proteínas',43),
  ('ab-coz-7','abertura','Cozinha','Ligar equipamentos',44),
  ('ab-coz-8','abertura','Cozinha','Conferir e limpar produtos expostos na lojinha — retirar vencidos para Paulo avaliar',45),
  ('ab-coz-9','abertura','Cozinha','Fazer frente de geladeira e ligar luz',46),
  ('ab-coz-10','abertura','Cozinha','Montar caixas de pizzas',47),
  ('ab-coz-11','abertura','Cozinha','Receber mercadorias, conferir entrega com a nota e lançar no sistema',48),
  ('ab-coz-12','abertura','Cozinha','Guardar mercadoria no estoque ou na cozinha',49),
  ('ab-coz-13','abertura','Cozinha','Retirar refrigerantes e águas estufados; limpar guaravitas e latas',50),
  ('ab-coz-14','abertura','Cozinha','Preparar limão para drinks e geladeiras',51),
  ('ab-bar-1','abertura','Bar','Abastecer bebidas',52),
  ('ab-bar-2','abertura','Bar','Conferir gelo',53),
  ('ab-bar-3','abertura','Bar','Organizar estação',54),
  ('ab-cai-1','abertura','Caixa','Abrir sistema',55),
  ('ab-cai-2','abertura','Caixa','Conferir troco',56),
  ('ab-cai-3','abertura','Caixa','Verificar maquininhas',57),
  ('ab-cai-4','abertura','Caixa','Limpar, organizar e abrir caixa',58),
  ('ab-cai-5','abertura','Caixa','Conferir, limpar e organizar tablet',59),
  ('ab-ger-1','abertura','Geral','5 min antes de iniciar o expediente da noite, distribuir radinhos',60),
  ('md-at-1','meio','Atendimento','Anotar reservas e controlar',0),
  ('md-at-2','meio','Atendimento','Anotar pedidos delivery',1),
  ('md-at-3','meio','Atendimento','Verificar fila de pedidos da cozinha antes de aceitar delivery',2),
  ('md-at-4','meio','Atendimento','Direcionar pessoas para as mesas',3),
  ('md-at-5','meio','Atendimento','Atender clientes',4),
  ('md-at-6','meio','Atendimento','Repassar para cozinha pedidos (exceto bebidas)',5),
  ('md-at-7','meio','Atendimento','Pegar bebidas e comidas na cozinha',6),
  ('md-at-8','meio','Atendimento','Fechar contas',7),
  ('md-at-9','meio','Atendimento','Embalar e entregar pedidos para caixa',8),
  ('md-1','meio','Salão','Limpeza contínua',9),
  ('md-2','meio','Cozinha','Reposição de insumos',10),
  ('md-3','meio','Bar','Reposição de bebidas',11),
  ('md-4','meio','Cozinha','Conferência de estoque crítico',12),
  ('md-5','meio','Cozinha','Organização da cozinha',13),
  ('md-6','meio','Cozinha','Descarte correto',14),
  ('md-7','meio','Cozinha','Controle de desperdício',15),
  ('md-8','meio','Salão','Conferência do salão',16),
  ('md-9','meio','Cozinha','Abastecimento de embalagens delivery',17),
  ('fc-coz-1','fechamento','Cozinha','Limpeza completa',0),
  ('fc-coz-2','fechamento','Cozinha','Organização final',1),
  ('fc-coz-3','fechamento','Cozinha','Contagem de estoque',2),
  ('fc-coz-4','fechamento','Cozinha','Etiquetagem',3),
  ('fc-coz-5','fechamento','Cozinha','Armazenamento correto',4),
  ('fc-coz-6','fechamento','Cozinha','Descarte de perdas',5),
  ('fc-coz-7','fechamento','Cozinha','Produção para dia seguinte',6),
  ('fc-coz-8','fechamento','Cozinha','Desligar equipamentos',7),
  ('fc-coz-9','fechamento','Cozinha','Fechamento da cozinha',8),
  ('fc-ger-1','fechamento','Geral','Retirar todos os lixos (bancada, banheiro e cozinha) entre 22:30 e 23:30',9),
  ('fc-ger-2','fechamento','Geral','Conferir e passar pano nas mesas antes de fechar',10),
  ('fc-ger-3','fechamento','Geral','Retirar placas de madeira e cone',11),
  ('fc-ger-4','fechamento','Geral','Virar as cadeiras',12),
  ('fc-ger-5','fechamento','Geral','Carregar radinho',13),
  ('fc-ger-6','fechamento','Geral','Retirar e desligar rádio',14),
  ('fc-ger-7','fechamento','Geral','Passar checklist de bebidas urgentes',15),
  ('fc-ger-8','fechamento','Geral','Verificar se desligou fritadeira',16),
  ('fc-ger-9','fechamento','Geral','Verificar se desligou gás',17),
  ('fc-ger-10','fechamento','Geral','Verificar se desligou luzes',18),
  ('fc-ger-11','fechamento','Geral','Acionar o alarme e fechar a casa — 100% conferido',19),
  ('fc-fr-1','fechamento','Frente','Fechar mesas frente',20),
  ('fc-fr-2','fechamento','Frente','Retirar luzes da frente',21),
  ('fc-fr-3','fechamento','Frente','Desligar luzes das geladeiras FR',22),
  ('fc-sp-1','fechamento','Salão Principal','Fechar mesas varanda interna',23),
  ('fc-sp-2','fechamento','Salão Principal','Varrer e passar pano no chão do salão',24),
  ('fc-sp-3','fechamento','Salão Principal','Desligar luzes das geladeiras SP',25),
  ('fc-sp-4','fechamento','Salão Principal','Desligar ar condicionado SP',26),
  ('fc-sf-1','fechamento','Salão dos Fundos','Desligar luzes das geladeiras SF',27),
  ('fc-sf-2','fechamento','Salão dos Fundos','Desligar ar condicionado SF',28),
  ('fc-cai-1','fechamento','Caixa','Fechar caixa, entregar notas e Excel',29),
  ('fc-ban-1','fechamento','Geral','Revisar banheiro',30),
  ('fc-ban-2','fechamento','Geral','Varrer e passar pano no chão do banheiro',31),
  ('fc-sal-1','fechamento','Salão','Fechamento do salão',32)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- 6. checklist_registros
-- =========================================================
CREATE TABLE IF NOT EXISTS public.checklist_registros (
  data       date NOT NULL,
  tipo       public.checklist_tipo NOT NULL,
  item_id    text NOT NULL REFERENCES public.checklist_itens(id) ON DELETE CASCADE,
  done       boolean NOT NULL DEFAULT false,
  observacao text,
  foto_url   text,
  done_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  done_at    timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (data, tipo, item_id)
);
CREATE INDEX IF NOT EXISTS checklist_registros_data_idx ON public.checklist_registros (data);

DROP TRIGGER IF EXISTS checklist_registros_touch ON public.checklist_registros;
CREATE TRIGGER checklist_registros_touch BEFORE UPDATE ON public.checklist_registros
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.checklist_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklist_registros read"   ON public.checklist_registros;
DROP POLICY IF EXISTS "checklist_registros insert" ON public.checklist_registros;
DROP POLICY IF EXISTS "checklist_registros update" ON public.checklist_registros;
CREATE POLICY "checklist_registros read"   ON public.checklist_registros FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_registros insert" ON public.checklist_registros FOR INSERT TO authenticated WITH CHECK (done_by = auth.uid() OR done_by IS NULL);
CREATE POLICY "checklist_registros update" ON public.checklist_registros FOR UPDATE TO authenticated USING (true) WITH CHECK (done_by = auth.uid() OR done_by IS NULL);

-- =========================================================
-- 7. activity_log
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.activity_tipo AS ENUM ('login','logout','checklist_item','user_approved','user_rejected','signup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome       text NOT NULL,
  tipo       public.activity_tipo NOT NULL,
  detalhe    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_user_created_idx ON public.activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_created_idx      ON public.activity_log (created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_log read"   ON public.activity_log;
DROP POLICY IF EXISTS "activity_log insert" ON public.activity_log;
CREATE POLICY "activity_log read"   ON public.activity_log FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_staff(auth.uid()));
CREATE POLICY "activity_log insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- =========================================================
-- 8. Storage bucket checklist-fotos (privado)
-- =========================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('checklist-fotos','checklist-fotos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "checklist-fotos read own"   ON storage.objects;
DROP POLICY IF EXISTS "checklist-fotos upload own" ON storage.objects;
DROP POLICY IF EXISTS "checklist-fotos update own" ON storage.objects;
CREATE POLICY "checklist-fotos read own"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'checklist-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "checklist-fotos upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'checklist-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "checklist-fotos update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'checklist-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);