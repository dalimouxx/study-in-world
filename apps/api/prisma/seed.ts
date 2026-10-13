/* Seed Study in World — idempotent.
 * - Base (toujours) : organisation, paramètres, branche, permissions, rôles, Super Admin.
 * - Démo (SEED_DEMO=true, jamais en production) : quelques employés de test.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PERMISSION_CODES, SYSTEM_ROLES, SUPER_ADMIN_ROLE } from '../src/rbac/permissions';
import { PASSWORD_REGEX } from '../src/auth/dto/auth.dto';

try {
  process.loadEnvFile('.env');
} catch {
  /* pas de fichier .env : on utilise l'environnement du processus */
}

const prisma = new PrismaClient();

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  const orgSlug = process.env.DEFAULT_ORG_SLUG ?? 'study-in-world';
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
  const demo = process.env.SEED_DEMO === 'true';

  if (!adminEmail || !PASSWORD_REGEX.test(adminPassword)) {
    throw new Error('SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD (10+ car., maj., min., chiffre) sont requis.');
  }
  if (demo && isProd) throw new Error('SEED_DEMO est interdit en production.');

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { slug: orgSlug, name: 'Study in World' },
  });

  await prisma.agencySettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Study in World',
      website: 'https://studyinworld.net',
      email: 'contact@studyinworld.net',
      currency: 'TND',
      timezone: 'Africa/Tunis',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'GAB' } },
    update: {},
    create: { organizationId: org.id, code: 'GAB', name: 'Study in World Gabès', city: 'Gabès' },
  });

  // Permissions (catalogue du code = source de vérité)
  for (const code of PERMISSION_CODES) {
    const [module, action] = code.split('.');
    await prisma.permission.upsert({ where: { code }, update: { module, action }, create: { code, module, action } });
  }
  const permissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(permissions.map((p) => [p.code, p.id]));

  // Rôles : Super Admin toujours synchronisé ; Administrateur reçoit les nouveaux droits ;
  // les autres rôles ne sont initialisés qu'à la création (les réglages faits dans l'interface sont conservés).
  const roleIds = new Map<string, string>();
  for (const def of SYSTEM_ROLES) {
    const existing = await prisma.role.findUnique({ where: { organizationId_code: { organizationId: org.id, code: def.code } } });
    const role =
      existing ??
      (await prisma.role.create({
        data: { organizationId: org.id, code: def.code, name: def.name, description: def.description, isSystem: true },
      }));
    roleIds.set(def.code, role.id);

    const wanted = def.permissions === 'ALL' ? [...PERMISSION_CODES] : def.permissions;
    const shouldSync = !existing || def.code === SUPER_ADMIN_ROLE || def.permissions === 'ALL';
    if (shouldSync) {
      await prisma.rolePermission.createMany({
        data: wanted.map((c) => ({ roleId: role.id, permissionId: idByCode.get(c)! })),
        skipDuplicates: true,
      });
    }
  }

  // Super Admin initial
  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    await prisma.user.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        roleId: roleIds.get(SUPER_ADMIN_ROLE)!,
        email: adminEmail,
        firstName: 'Super',
        lastName: 'Admin',
        passwordHash: await argon2.hash(adminPassword),
        mustChangePassword: true,
        // Le compte créé par ce script est le vôtre : il devient aussi administrateur de la plateforme
        // (SaaS multi-agences, section 12) — jamais réglable depuis l'écran de gestion des employés, seulement
        // ici, à la création du tout premier compte.
        isPlatformAdmin: true,
      },
    });
    console.log(`Super Admin créé : ${adminEmail} (changement de mot de passe exigé à la 1re connexion)`);
  }

  // Articles de blog d'exemple — conseils génériques et vrais, pas de contenu inventé sur l'agence elle-même
  // (pas de témoignage, pas de statistique). À modifier ou remplacer directement depuis /blog-admin.
  const examplePosts = [
    {
      slug: 'documents-a-preparer-visa-etudes',
      title: "5 documents à préparer avant de déposer votre dossier de visa d'études",
      excerpt: "Un dossier de visa bien préparé se joue souvent dans les détails. Voici les documents à réunir en priorité.",
      content: `Un dossier de visa d'études incomplet est l'une des premières causes de retard. Voici les documents les plus souvent demandés, quelle que soit la destination :

1. Le passeport en cours de validité, avec au moins deux pages vierges et une validité dépassant la durée prévue du séjour.

2. La lettre d'admission de l'établissement, précisant le programme, la date de début des cours et la durée des études.

3. La preuve de ressources financières suffisantes pour couvrir les frais de scolarité et le coût de la vie sur place.

4. Le certificat de langue correspondant au programme choisi (par exemple IELTS ou TOEFL pour un programme en anglais).

5. Une assurance santé valable pour toute la durée du séjour dans le pays de destination.

Chaque pays a ses propres exigences précises et ses propres délais de traitement. Un accompagnement personnalisé permet de vérifier que rien ne manque avant le dépôt, ce qui reste la meilleure façon d'éviter un refus pour un motif purement administratif.`,
    },
    {
      slug: 'comment-choisir-sa-destination-etudes',
      title: 'Comment choisir sa destination d’études à l’étranger',
      excerpt: 'Coût de la vie, langue d’enseignement, débouchés professionnels : les critères qui comptent vraiment.',
      content: `Choisir où étudier à l'étranger dépend de plusieurs critères, à peser selon sa situation personnelle :

Le coût des études et de la vie sur place reste souvent déterminant : les frais de scolarité et le coût du logement varient énormément d'un pays à l'autre, parfois du simple au triple pour un programme comparable.

La langue d'enseignement doit correspondre à un niveau réellement atteint, ou à une réelle motivation pour l'apprendre avant le départ : réussir ses études dans une langue insuffisamment maîtrisée est une source de difficulté fréquente.

Les débouchés après le diplôme varient aussi selon les pays : certaines destinations offrent des possibilités de rester travailler après les études, d'autres non, ou sous conditions.

Enfin, le cadre de vie (climat, sécurité, distance avec la famille) pèse davantage qu'on ne le pense sur la réussite d'un projet d'études à l'étranger. Il n'y a pas de destination universellement "meilleure" — seulement celle qui correspond le mieux à son propre profil et à ses propres objectifs.`,
    },
    {
      slug: 'sejour-linguistique-ou-formation-professionnelle',
      title: 'Séjour linguistique ou formation professionnelle : que choisir ?',
      excerpt: 'Deux parcours différents, pour deux objectifs différents. Comment savoir lequel correspond à votre projet.',
      content: `Un séjour linguistique et une formation professionnelle répondent à des besoins différents, et le choix dépend surtout de l'objectif poursuivi.

Le séjour linguistique convient à celles et ceux qui veulent avant tout progresser dans une langue, dans un cadre d'immersion, sans viser directement un diplôme ou une qualification professionnelle. C'est souvent une première étape avant un projet d'études plus long, ou une expérience en soi.

La formation professionnelle vise, elle, l'acquisition d'une compétence concrète, reconnue sur le marché du travail, généralement sanctionnée par une certification. Elle convient à celles et ceux qui ont déjà une idée assez précise du métier ou du secteur visé.

Dans les deux cas, la durée, le budget et le niveau de langue de départ sont des facteurs déterminants pour choisir un programme réaliste. Un accompagnement personnalisé permet d'y voir plus clair avant de s'engager.`,
    },
  ];
  for (const post of examplePosts) {
    await prisma.blogPost.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: post.slug } },
      update: {},
      create: { organizationId: org.id, status: 'PUBLISHED', publishedAt: new Date(), ...post },
    });
  }

  if (demo) {
    const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo-Password-2026';
    const people = [
      { email: 'directeur@demo.local', firstName: 'Karim', lastName: 'Directeur', role: 'DIRECTOR' },
      { email: 'conseiller@demo.local', firstName: 'Sana', lastName: 'Conseillère', role: 'ADVISOR' },
      { email: 'comptable@demo.local', firstName: 'Nour', lastName: 'Comptable', role: 'ACCOUNTANT' },
      { email: 'reception@demo.local', firstName: 'Amel', lastName: 'Réception', role: 'RECEPTION' },
    ];
    for (const p of people) {
      await prisma.user.upsert({
        where: { email: p.email },
        update: {},
        create: {
          organizationId: org.id,
          branchId: branch.id,
          roleId: roleIds.get(p.role)!,
          email: p.email,
          firstName: p.firstName,
          lastName: p.lastName,
          passwordHash: await argon2.hash(demoPassword),
        },
      });
    }
    console.log('Employés de démonstration créés (@demo.local).');

    // Quelques entrées de catalogue pour ne pas démarrer avec un site public vide (Phase 4).
    const italy = await prisma.country.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: 'italie' } },
      update: {},
      create: {
        organizationId: org.id,
        slug: 'italie',
        name: 'Italie',
        flagEmoji: '🇮🇹',
        description: 'Universités publiques peu coûteuses, forte présence de programmes en anglais.',
        advantages: 'Frais de scolarité très bas dans le public, coût de la vie raisonnable hors grandes villes.',
        costOfLiving: 'Environ 600 à 900 € par mois selon la ville.',
        admissionConditions: 'Bac + relevés de notes + test de langue selon le programme (test TOLC pour certaines filières).',
        visaInfo: 'Visa D étudiant, permesso di soggiorno à retirer dans les 8 jours suivant l’arrivée.',
      },
    });
    const rome = await prisma.university.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: 'universita-di-roma-la-sapienza' } },
      update: {},
      create: {
        organizationId: org.id,
        countryId: italy.id,
        slug: 'universita-di-roma-la-sapienza',
        name: 'Università di Roma La Sapienza',
        city: 'Rome',
        isPublic: true,
        description: 'Une des plus grandes universités publiques d’Europe.',
      },
    });
    await prisma.program.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: 'master-informatique-la-sapienza' } },
      update: {},
      create: {
        organizationId: org.id,
        universityId: rome.id,
        slug: 'master-informatique-la-sapienza',
        name: 'Master en Informatique',
        level: 'MASTER',
        domain: 'Informatique',
        language: 'Anglais',
        durationMonths: 24,
        tuitionFees: 2000,
        currency: 'EUR',
        intake: 'Automne 2026',
        minIelts: 6,
        description: 'Programme de master en informatique enseigné en anglais.',
      },
    });
    console.log('Catalogue de démonstration créé (Italie / La Sapienza / Master Informatique).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
