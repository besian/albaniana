import { Article, ArticleStatus, Section, User, UserRole, Block } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Administrator', role: UserRole.ADMIN, avatar: 'https://ui-avatars.com/api/?name=Admin&background=000&color=fff' },
  { id: 'u2', name: 'Ben Blushi (Editor)', role: UserRole.EDITOR, avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: 'u3', name: 'Jona Gazetare', role: UserRole.AUTHOR, avatar: 'https://i.pravatar.cc/150?u=3' },
];

export const SUBSECTIONS: Record<Section, string[]> = {
  [Section.LAJME]: ['Vendore', 'Botërore'],
  [Section.KULTURE]: ['Letërsi', 'Arte Pamore', 'Film & Teatër', 'Muzikë', 'Dizajn & Arkitekturë', 'Histori', 'Kanuni'],
  [Section.SHOQERI]: ['Gjuhësi', 'Histori', 'Politikë', 'Kujtesë', 'Arkivë'],
  [Section.RUBRIKA]: ['Kolumne', 'Ese', 'Intervista', 'Profile', 'Dosja', 'Recensione', 'Përkthime'],
  [Section.KRIJIMTARI]: ['Poezi', 'Tregim', 'Fotografi', 'Ilustrim', 'Multimedia'],
  [Section.SHKENCETEK]: [],
  [Section.BIBLIOTEKA]: ['Librel', 'Rrjetina', 'Enciklopedi']
};

const loremBlocks: Block[] = [
  { id: 'b1', type: 'paragraph', content: "Tirana po pëson një transformim rrënjësor kulturor ndërsa brezi i ri përqafon artin bashkëkohor. Galeritë e reja po mbijnë në çdo cep të qytetit, duke sjellë një frymë të re vitaliteti." },
  { id: 'b2', type: 'quote', content: "Arti nuk është luks, por domosdoshmëri për shpirtin e një kombi." },
  { id: 'b3', type: 'paragraph', content: "Kjo lëvizje nuk është vetëm estetike; ajo po ndryshon mënyrën se si qytetarët ndërveprojnë me hapësirën publike dhe me njëri-tjetrin." },
];

export const MOCK_ARTICLES: Article[] = [
  {
    id: 'a1',
    title: 'Rilindja Kulturore e Tiranës: Një Perspektivë e Re',
    subtitle: 'Si artistët e rinj po transformojnë kryeqytetin përmes iniciativave të pavarura.',
    authorId: 'u3',
    authorName: 'Jona Gazetare',
    section: Section.KULTURE,
    tags: ['Art', 'Tirana', 'Rini'],
    status: ArticleStatus.PUBLISHED,
    publishDate: new Date().toISOString(),
    heroImage: 'https://picsum.photos/800/450',
    content: loremBlocks,
    views: 1250
  },
  {
    id: 'a2',
    title: 'Ekonomia Dixhitale në Ballkan',
    subtitle: 'Sfida dhe mundësi për sipërmarrësit shqiptarë në tregun global.',
    authorId: 'u2',
    authorName: 'Ben Blushi (Editor)',
    section: Section.LAJME,
    tags: ['Ekonomi', 'Tech', 'Ballkan'],
    status: ArticleStatus.PUBLISHED,
    publishDate: new Date(Date.now() - 86400000).toISOString(),
    heroImage: 'https://picsum.photos/800/451',
    content: loremBlocks,
    views: 890
  },
  {
    id: 'a3',
    title: 'Zgjedhjet dhe Demokracia',
    subtitle: 'Analizë e thelluar mbi proceset demokratike në rajon.',
    authorId: 'u3',
    authorName: 'Jona Gazetare',
    section: Section.SHOQERI, // Was OPINION
    tags: ['Politikë', 'Zgjedhje'],
    status: ArticleStatus.DRAFT,
    publishDate: undefined,
    heroImage: 'https://picsum.photos/800/452',
    content: loremBlocks,
    views: 0
  },
  {
    id: 'a4',
    title: 'Festivali i Filmit në Prishtinë',
    subtitle: 'Një javë plot emocione dhe kinema botërore.',
    authorId: 'u2',
    authorName: 'Ben Blushi (Editor)',
    section: Section.RUBRIKA, // Was RECENSIONE
    subcategory: 'Recensione',
    tags: ['Film', 'Prishtina'],
    status: ArticleStatus.PUBLISHED,
    publishDate: new Date(Date.now() - 172800000).toISOString(),
    heroImage: 'https://picsum.photos/800/453',
    content: loremBlocks,
    views: 3400
  },
  {
    id: 'a5',
    title: 'E ardhmja e Inteligjencës Artificiale',
    subtitle: 'Çfarë do të thotë Gemini për krijuesit e përmbajtjes?',
    authorId: 'u1',
    authorName: 'Administrator',
    section: Section.SHKENCETEK, // Was SHKENCE_TEKNOLOGJI
    tags: ['AI', 'Teknologji'],
    status: ArticleStatus.REVIEW,
    publishDate: undefined,
    heroImage: 'https://picsum.photos/800/454',
    content: loremBlocks,
    views: 0
  }
];