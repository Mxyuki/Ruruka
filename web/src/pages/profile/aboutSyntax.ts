export interface AboutSyntax {
  name: string;
  description: string;
  /** Inserted around the selection, or around `placeholder` when nothing is selected. */
  before: string;
  placeholder: string;
  after: string;
  /** Shown as a button in the editor toolbar. */
  isQuick?: boolean;
}

export interface AboutSyntaxGroup {
  title: string;
  entries: AboutSyntax[];
}

export const aboutSyntaxGroups: AboutSyntaxGroup[] = [
  {
    title: 'Texte',
    entries: [
      { name: 'Gras', description: 'Met le texte en gras. « **texte** » marche aussi.', before: '__', placeholder: 'texte en gras', after: '__', isQuick: true },
      { name: 'Italique', description: 'Penche le texte. « *texte* » marche aussi.', before: '_', placeholder: 'texte penché', after: '_', isQuick: true },
      { name: 'Barré', description: 'Raye le texte.', before: '~~', placeholder: 'texte barré', after: '~~', isQuick: true },
      { name: 'Titre', description: 'En début de ligne. De « # » (le plus grand) à « ##### » (le plus petit).', before: '# ', placeholder: 'Mon titre', after: '', isQuick: true },
      { name: 'Lien', description: 'Un texte cliquable. Les liens anilist.co s’ouvrent directement dans Ruruka.', before: '[', placeholder: 'texte du lien', after: '](https://anilist.co)', isQuick: true },
      { name: 'Code', description: 'Texte à chasse fixe, affiché tel quel.', before: '`', placeholder: 'code', after: '`' },
    ],
  },
  {
    title: 'Mise en page',
    entries: [
      { name: 'Centrer', description: 'Centre tout ce qui est entre les « ~~~ » : texte, images, vidéos, sur plusieurs lignes si besoin.', before: '~~~', placeholder: 'contenu centré', after: '~~~', isQuick: true },
      { name: 'Spoiler', description: 'Cache le contenu (texte ou images) derrière une étiquette à cliquer.', before: '~!', placeholder: 'secret de l’enquête', after: '!~', isQuick: true },
      { name: 'Citation', description: 'En début de ligne : un bloc de citation.', before: '> ', placeholder: 'une citation', after: '' },
      { name: 'Liste', description: 'Une ligne par élément. « 1. » au lieu de « - » pour une liste numérotée.', before: '- ', placeholder: 'élément', after: '' },
      { name: 'Séparateur', description: 'Une ligne horizontale, seule sur sa ligne.', before: '\n---\n', placeholder: '', after: '' },
    ],
  },
  {
    title: 'Images et vidéos',
    entries: [
      { name: 'Image', description: 'Affiche une image à partir de son lien direct (imgur, catbox…).', before: 'img(', placeholder: 'https://i.imgur.com/image.png', after: ')', isQuick: true },
      { name: 'Image à largeur fixe', description: 'Le nombre fixe la largeur en pixels. « img50% » prend la moitié de la largeur.', before: 'img220(', placeholder: 'https://i.imgur.com/image.png', after: ')' },
      { name: 'Image cliquable', description: 'Une image qui ouvre un lien : l’image se met à la place du texte du lien.', before: '[img200(https://i.imgur.com/image.png)](', placeholder: 'https://anilist.co', after: ')' },
      { name: 'YouTube', description: 'Intègre le lecteur YouTube. Le lien complet ou juste l’identifiant de la vidéo.', before: 'youtube(', placeholder: 'https://www.youtube.com/watch?v=', after: ')', isQuick: true },
      { name: 'Vidéo webm', description: 'Lue en boucle et sans son, comme un GIF.', before: 'webm(', placeholder: 'https://files.catbox.moe/video.webm', after: ')' },
    ],
  },
  {
    title: 'En direct (Ruruka)',
    entries: [
      { name: '[watching]', description: 'Le texte entre [watching] et [/watching] n’apparaît que lorsque tu regardes un épisode dans Ruruka. Ces balises restent sur ce PC : AniList reçoit le texte rempli.', before: '[watching]', placeholder: 'Watching ${episode} / ${episodes} of ${anime}, ${time} / ${duration}', after: '[/watching]', isQuick: true },
      { name: '[idle]', description: 'Le texte entre [idle] et [/idle] n’apparaît que lorsque tu ne regardes rien. Les balises y parlent du dernier anime avancé dans ta liste.', before: '[idle]', placeholder: 'Last watched: ${anime}, episode ${episode}', after: '[/idle]' },
      { name: '${anime}', description: 'Titre de l’anime, dans la langue de titre de ton compte.', before: '', placeholder: '${anime}', after: '' },
      { name: '${episode}', description: 'Numéro de l’épisode en cours (au repos : ta progression).', before: '', placeholder: '${episode}', after: '' },
      { name: '${episodes}', description: 'Nombre total d’épisodes, « ? » s’il n’est pas encore connu.', before: '', placeholder: '${episodes}', after: '' },
      { name: '${time}', description: 'Où tu en es dans l’épisode (12:34).', before: '', placeholder: '${time}', after: '' },
      { name: '${duration}', description: 'Durée de l’épisode (23:40).', before: '', placeholder: '${duration}', after: '' },
      { name: '${remaining}', description: 'Temps restant avant la fin de l’épisode.', before: '', placeholder: '${remaining}', after: '' },
      { name: '${percent}', description: 'Progression dans l’épisode, en pourcentage (sans le « % »).', before: '', placeholder: '${percent}', after: '' },
      { name: '${cover}', description: 'Lien de l’affiche de l’anime, à mettre dans une image.', before: 'img200(', placeholder: '${cover}', after: ')' },
      { name: '${banner}', description: 'Lien de la bannière de l’anime (vide s’il n’en a pas).', before: 'img(', placeholder: '${banner}', after: ')' },
      { name: '${link}', description: 'Lien de la page AniList de l’anime.', before: '[${anime}](', placeholder: '${link}', after: ')' },
      { name: '${updated}', description: 'Heure de la dernière mise à jour du profil (21:42).', before: '', placeholder: '${updated}', after: '' },
    ],
  },
  {
    title: 'HTML',
    entries: [
      { name: '<center>', description: 'Centre un bloc. Le markdown reste actif à l’intérieur.', before: '<center>', placeholder: 'contenu centré', after: '</center>' },
      { name: '<div align="center">', description: 'Autre façon de centrer, pratique pour regrouper des images.', before: '<div align="center">', placeholder: 'contenu centré', after: '</div>' },
      { name: '<img>', description: 'Image en HTML, avec une largeur en pixels ou en pourcentage.', before: '<img src="', placeholder: 'https://i.imgur.com/image.png', after: '" width="200">' },
      { name: '<a>', description: 'Lien en HTML, peut entourer une image.', before: '<a href="https://anilist.co">', placeholder: 'texte du lien', after: '</a>' },
      { name: '<u>', description: 'Souligne le texte (pas d’équivalent en markdown).', before: '<u>', placeholder: 'texte souligné', after: '</u>' },
      { name: '<br>', description: 'Force un retour à la ligne, utile dans un bloc HTML.', before: '<br>', placeholder: '', after: '' },
    ],
  },
];

export const quickSyntaxes = aboutSyntaxGroups.flatMap((group) => group.entries).filter((entry) => entry.isQuick);
