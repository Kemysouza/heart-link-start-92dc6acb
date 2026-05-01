-- =============================================================
-- Hardening de segurança (LGPD) e integridade da agenda
-- =============================================================

-- -------------------------------------------------------------
-- 1) Remover policy "Patients can view psychologist profiles"
--    em public.profiles que vazava email/telefone de psicólogos.
--    Substituímos por uma VIEW pública com colunas seguras.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Patients can view psychologist profiles" ON public.profiles;

-- View segura com apenas os campos públicos do psicólogo
CREATE OR REPLACE VIEW public.psychologist_directory
WITH (security_invoker = true) AS
SELECT
  p.user_id,
  p.nome_completo,
  pp.crp,
  pp.trajetoria_profissional,
  pp.especializacoes
FROM public.profiles p
JOIN public.psychologist_profiles pp ON pp.user_id = p.user_id
WHERE p.role = 'psicologo'
  AND p.onboarding_completed = true;

GRANT SELECT ON public.psychologist_directory TO authenticated;

-- Permitir paciente ver SOMENTE nome_completo de outros usuários
-- com quem ele tem appointments / messages (via função SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.get_user_display_name(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_name TEXT;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN NULL;
  END IF;

  -- caller pode ver nome se: é o próprio, é psicólogo de quem é paciente,
  -- é paciente de quem é psicólogo, ou trocaram mensagens.
  IF v_caller = target_user_id
     OR EXISTS (SELECT 1 FROM public.psychologist_patients
                WHERE (psychologist_id = v_caller AND patient_id = target_user_id)
                   OR (patient_id = v_caller AND psychologist_id = target_user_id))
     OR EXISTS (SELECT 1 FROM public.messages
                WHERE (sender_id = v_caller AND receiver_id = target_user_id)
                   OR (receiver_id = v_caller AND sender_id = target_user_id))
     OR EXISTS (SELECT 1 FROM public.appointments
                WHERE (psychologist_id = v_caller AND patient_id = target_user_id)
                   OR (patient_id = v_caller AND psychologist_id = target_user_id))
  THEN
    SELECT nome_completo INTO v_name FROM public.profiles WHERE user_id = target_user_id;
    RETURN v_name;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;

-- -------------------------------------------------------------
-- 2) Constraint de exclusão para impedir agendamento duplo
--    no mesmo psicólogo / data / faixa de horário.
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING GIST (
    psychologist_id WITH =,
    appointment_date WITH =,
    tsrange(
      (appointment_date + start_time)::timestamp,
      (appointment_date + end_time)::timestamp,
      '[)'
    ) WITH &&
  )
  WHERE (status IN ('agendado', 'confirmado'));

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_appointments_psych_date
  ON public.appointments(psychologist_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
  ON public.appointments(patient_id, appointment_date);

-- -------------------------------------------------------------
-- 3) Validação na criação de appointment:
--    a) horário não no passado
--    b) caber dentro de availability_slots configurada
--    c) start_time < end_time
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dow INTEGER;
  v_has_slot BOOLEAN;
BEGIN
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Horário inválido: início deve ser antes do fim';
  END IF;

  -- não no passado (com tolerância de 1 minuto)
  IF (NEW.appointment_date + NEW.start_time) < (now() - interval '1 minute') THEN
    RAISE EXCEPTION 'Não é possível agendar em horário passado';
  END IF;

  -- dia da semana 0=Dom..6=Sab
  v_dow := EXTRACT(DOW FROM NEW.appointment_date)::INTEGER;

  SELECT EXISTS (
    SELECT 1 FROM public.availability_slots a
    WHERE a.psychologist_id = NEW.psychologist_id
      AND a.day_of_week = v_dow
      AND a.is_available = true
      AND a.start_time <= NEW.start_time
      AND a.end_time >= NEW.end_time
  ) INTO v_has_slot;

  IF NOT v_has_slot THEN
    RAISE EXCEPTION 'Profissional não atende neste horário';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_validate ON public.appointments;
CREATE TRIGGER appointments_validate
BEFORE INSERT OR UPDATE OF appointment_date, start_time, end_time, psychologist_id
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment();

-- -------------------------------------------------------------
-- 4) Permitir paciente cancelar próprio agendamento
--    (a policy original só permitia psicólogo dar UPDATE).
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Patients can cancel their appointments" ON public.appointments;
CREATE POLICY "Patients can cancel their appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id AND status = 'cancelado');

-- -------------------------------------------------------------
-- 5) Restringir mensagens: só pode enviar para alguém com quem
--    existe vínculo (psychologist_patients) OU para um psicólogo
--    listado no diretório (primeira mensagem do paciente).
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    -- já existe vínculo
    EXISTS (
      SELECT 1 FROM public.psychologist_patients
      WHERE (psychologist_id = sender_id AND patient_id = receiver_id)
         OR (patient_id = sender_id AND psychologist_id = receiver_id)
    )
    -- OU paciente mandando para psicólogo cadastrado
    OR EXISTS (
      SELECT 1 FROM public.psychologist_profiles
      WHERE user_id = receiver_id
    )
  )
);

-- -------------------------------------------------------------
-- 6) Validação de CRP (formato XX/NNNNNN com 4 a 6 dígitos).
--    Não substitui validação no painel do Conselho, mas barra
--    valores manifestamente inválidos.
-- -------------------------------------------------------------
ALTER TABLE public.psychologist_profiles
  DROP CONSTRAINT IF EXISTS psychologist_profiles_crp_format;
ALTER TABLE public.psychologist_profiles
  ADD CONSTRAINT psychologist_profiles_crp_format
  CHECK (crp ~ '^\d{2}/\d{4,6}$');

-- -------------------------------------------------------------
-- 7) Habilitar realtime em appointments para que pacientes vejam
--    slots ocupando ao vivo enquanto a agenda está aberta.
-- -------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- -------------------------------------------------------------
-- 8) Política para que psicólogo veja perfil de paciente que
--    AGENDOU com ele (mesmo antes de ser efetivamente vinculado),
--    pois o vínculo pode ainda não ter sido criado.
-- -------------------------------------------------------------
CREATE POLICY "Psychologists can view profiles of their booking patients"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.psychologist_id = auth.uid()
      AND a.patient_id = profiles.user_id
  )
);
