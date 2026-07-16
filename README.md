# DuoBiblia

DuoBiblia es una aplicación Android/iOS bilingüe para leer la Biblia, aprender inglés palabra por palabra y mantener una práctica devocional diaria. La interfaz está construida con Vite y se empaqueta como aplicación nativa mediante Capacitor.

## Funciones incluidas

- elección inicial de idioma con la explicación cruzada en el otro idioma;
- registro emocional diario y recomendación de un pasaje;
- oración de mañana, tarde o noche según la hora local, cuatro instrumentales aleatorios, sonido activo por defecto y control animado;
- recordatorios locales de oración a las 7:00, 15:00 y 21:30, configurados en el idioma elegido;
- racha, puntos, meta de 90 días, reto diario y animaciones de logros;
- lectura completa KJV y **Mi Biblia traducida**, extraída exclusivamente del PDF entregado por el propietario;
- selección de una o varias palabras, traducción contextual de frases o versículos y pronunciación;
- favoritos, notas, colores y tarjetas gráficas para compartir en cualquier versículo de ambas Biblias;
- interfaz completa en español e inglés, modo oscuro y transiciones;
- anuncios AdMob de apertura y de logro; Premium los elimina;
- cuenta real con Google o código de seis dígitos por correo mediante Supabase;
- sincronización de racha, puntos, favoritos, notas y progreso local al crear la cuenta;
- checkout Premium mediante el enlace Bold entregado y activación solo después de un webhook firmado y aprobado;
- actualización obligatoria controlada remotamente por versión;
- fondos devocionales rotativos e ilustraciones originales para acciones, logros y secciones;
- iconos web, Android e iOS derivados del logotipo entregado.

## Ejecutar y verificar

Se necesita Node.js 20 o posterior y pnpm.

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

La aplicación de desarrollo queda en `http://127.0.0.1:4173` y la compilación en `dist/`.

## Configuración real de cuentas

El código no incorpora claves privadas. Copiar `.env.example` a `.env` y completar:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICABLE
VITE_EXTERNAL_BILLING_ENABLED=true
```

En Supabase:

1. Crear el proyecto y aplicar `supabase/migrations/202607130001_auth_billing.sql`.
2. En Auth > Email Templates, usar `{{ .Token }}` en el mensaje para que el usuario reciba un código de seis dígitos.
3. Activar Google como proveedor y registrar las URL web y `com.duobiblia.app://auth/callback` entre las redirecciones autorizadas.
4. Añadir las credenciales OAuth de Google en el panel de Supabase.

La primera autenticación combina el progreso que ya existe en el celular con el perfil remoto; los puntos y la racha conservan el valor mayor y se unen favoritos y notas.

## Premium con Bold

El checkout usa exactamente:

`https://checkout.bold.co/payment/LNK_84NNU7YDX9`

El botón exige una cuenta verificada. El comprador debe usar en Bold el mismo correo de la cuenta. La app **no** activa Premium al abrir el enlace: espera la confirmación criptográfica de Bold.

Despliegue del backend:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
supabase secrets set BOLD_WEBHOOK_SECRET=TU_SECRETO BOLD_PAYMENT_REFERENCE=LNK_84NNU7YDX9
supabase functions deploy bold-webhook --no-verify-jwt
```

En el panel de Bold, registrar como webhook:

`https://TU-PROYECTO.supabase.co/functions/v1/bold-webhook`

El backend verifica `x-bold-signature`, acepta únicamente `SALE_APPROVED`, exige la referencia exacta `LNK_84NNU7YDX9`, evita eventos duplicados y concede un mes únicamente a la cuenta verificada cuyo correo coincide con `payer_email`.

Cada pago aprobado añade un mes a la fecha vigente; al vencer, Premium se desactiva automáticamente. El enlace compartido de Bold no permite cobrar otra vez por sí solo. Para una renovación automática real se necesita que Bold habilite la **API de Pagos en Línea recurrentes**, entregue una clave de producción y apruebe la integración. Nunca se almacenan números de tarjeta en DuoBiblia.

Importante para las tiendas: Google Play y Apple normalmente exigen sus propios sistemas de compra para desbloquear funciones digitales. El enlace Bold puede usarse en una distribución directa o solo en programas/regiones donde la tienda autorice ofertas externas. Para un build de tienda sin esa autorización, compilar con `VITE_EXTERNAL_BILLING_ENABLED=false`; habilitar Bold sin cumplir la política puede causar rechazo.

Referencias oficiales: [Bold API de pagos](https://www.developers.bold.co/pagos-en-linea/api-de-pagos-en-linea), [Bold webhooks](https://developers.bold.co/webhook), [Supabase OTP](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [Google Play payments](https://support.google.com/googleplay/android-developer/answer/10281818) y [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## Actualización obligatoria

Las migraciones crean `public.app_versions` y un contenedor público `releases`. Cada instalación consulta la tabla al arrancar. Si su versión es menor que `minimum_version`, toda la aplicación queda bloqueada y solo muestra **Actualizar ahora**, que abre la descarga configurada.

Flujo seguro para publicar una actualización:

1. Incrementar `APP_VERSION` en `src/update-service.mjs`, `version` en `package.json`, `versionName/versionCode` en Android y `MARKETING_VERSION/CURRENT_PROJECT_VERSION` en iOS.
2. Compilar y probar el APK firmado con la misma clave de siempre.
3. Subirlo primero y comprobar que la URL pública funciona.
4. Actualizar `latest_version` en `app_versions`.
5. Para hacerla obligatoria, actualizar después `minimum_version` al mismo número.

Ejemplo:

```sql
update public.app_versions
set latest_version = '1.5.0', minimum_version = '1.5.0', updated_at = now()
where platform = 'android';
```

No se debe aumentar `minimum_version` antes de que la tienda ofrezca el build, porque los usuarios quedarían bloqueados sin una actualización instalable. En iOS se debe reemplazar el ID provisional `id0000000000` por el ID real de App Store.

Para distribución directa en Android, aplicar también `supabase/migrations/202607130002_apk_releases.sql` y publicar con:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "CLAVE_PRIVADA_SOLO_EN_TU_PC"
./scripts/publish-apk.ps1 -ProjectUrl "https://TU-PROYECTO.supabase.co" -ApkPath "./DuoBiblia-1.5.0.apk" -Version "1.5.0" -MinimumVersion "1.5.0"
```

El script sube primero el APK y solo después cambia la versión obligatoria, evitando dejar instalaciones bloqueadas sin archivo descargable.

La primera compilación crea una clave de firma estable y protegida por Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/initialize-android-signing.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-android-apk.ps1 -NodePath "C:\ruta\a\node.exe"
```

El APK queda en `releases/DuoBiblia-VERSION.apk`. La compilación de prueba usa anuncios de prueba aunque sea un APK `release`; para un build público con los bloques reales se usa `-ProductionAds`. Es imprescindible respaldar juntos `.signing/duobiblia-release.jks` y `.signing/keystore-password.dpapi`: Android solo acepta una actualización si está firmada con la misma clave. El segundo archivo está cifrado para la cuenta actual de Windows.

Google documenta el flujo de actualización inmediata para Android en [In-app updates](https://developer.android.com/guide/playcore/in-app-updates). DuoBiblia aplica además el bloqueo multiplataforma desde el servidor.

## Probar en un celular Android

Para instalar el APK ya generado **no hace falta activar Opciones de desarrollador ni Depuración USB**. En Android basta con permitir temporalmente **Instalar apps desconocidas** al navegador o administrador de archivos que abra el APK.

Para compilar o depurar desde el computador:

1. Instalar Android Studio, JDK y el Android SDK.
2. Activar Opciones de desarrollador y Depuración USB únicamente si se usará un cable.
3. Completar `.env` con el proyecto Supabase de prueba.
4. Ejecutar:

```bash
pnpm native:sync:android
pnpm android
```

5. En Android Studio elegir el celular conectado y pulsar **Run**.

Para entregar a testers sin cable, usar el APK firmado de `releases` o una pista de Internal testing en Google Play. iOS requiere una Mac con Xcode, una cuenta Apple Developer y un iPhone registrado; se distribuye primero por TestFlight.

## Publicación

Android se firma y entrega como `.aab` desde Android Studio. iOS se archiva desde Xcode y se sube a App Store Connect. Antes de revisión se necesitan política de privacidad, términos, soporte, eliminación de cuenta, ficha de seguridad de datos, consentimiento de anuncios, capturas y credenciales de revisión.

El ID nativo actual es `com.duobiblia.app`. Debe conservarse una vez publicada la primera versión.

## Biblias y activos

- Español: `Mi Biblia traducida.pdf`, 619 páginas, 66 libros y 31.102 referencias. SHA-256: `c52730697b34bb989b2cd223b40d7b6651f5714dd14955c5db4581addc61a910`.
- Inglés: KJV 1769, 66 libros y 31.102 versículos.
- Logo: imagen entregada por el propietario, aplicada en la interfaz y recursos nativos.
- Música: cuatro instrumentales entregados por el propietario.

Una guía interna de límites se conserva fuera del paquete publicado para una posible reimportación; **no es una versión seleccionable ni se distribuye dentro de la aplicación**. Todo texto español que ve el usuario proviene del PDF indicado.

## Archivos principales

- `app.js`: pantallas, navegación e interacciones.
- `src/auth-service.mjs`: Google, OTP y sincronización.
- `src/billing-service.mjs`: apertura segura de Bold.
- `src/update-service.mjs`: control remoto de versión mínima.
- `supabase/`: base de datos y webhook firmado.
- `scripts/import-user-bible.py`: extracción reproducible del PDF.
- `static/data/mi-biblia.json`: texto español distribuido.
- `tests/core.test.mjs`: comprobaciones automáticas.
