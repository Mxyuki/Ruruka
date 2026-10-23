; <-- Installateur de Ruruka : un seul exe qui demande le dossier, copie l'app et crée les raccourcis -->
; Compilé par scripts/release.ps1, qui fournit AppVersion, SourceDir et OutputDir.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\dist\app"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

[Setup]
AppId={{6B4F3C2E-8E1A-4F7B-9C55-2D1E7A9B3F10}
AppName=Ruruka
AppVersion={#AppVersion}
AppVerName=Ruruka {#AppVersion}
AppPublisher=Mxyuki
AppPublisherURL=https://github.com/Mxyuki/Ruruka
AppSupportURL=https://github.com/Mxyuki/Ruruka/issues
DefaultDirName={autopf}\Ruruka
DefaultGroupName=Ruruka
DisableProgramGroupPage=yes
DisableDirPage=no
; <-- Installation sans droits admin pour l'utilisateur courant, « tous les utilisateurs » reste proposé -->
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#OutputDir}
OutputBaseFilename=Ruruka-Setup-{#AppVersion}
SetupIconFile=..\assets\ruruka.ico
UninstallDisplayIcon={app}\Ruruka.exe
UninstallDisplayName=Ruruka
WizardStyle=modern
WizardImageFile=wizard-image.bmp,wizard-image@2x.bmp
WizardSmallImageFile=wizard-small.bmp,wizard-small@2x.bmp
Compression=lzma2/ultra64
SolidCompression=yes
; <-- Ruruka reste dans la zone de notification : ce mutex permet de demander de le quitter avant la mise à jour -->
AppMutex=Ruruka.SingleInstance
CloseApplications=yes

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
french.WelcomeLabel1=Bienvenue dans le carnet d'enquête de Ruruka !
french.WelcomeLabel2=Ruruka va s'installer sur ton ordinateur : ta liste AniList, tes dossiers d'anime et mpv, réunis dans un petit carnet magique.%n%nClique sur Suivant pour ouvrir l'enquête.
french.FinishedHeadingLabel=Affaire résolue !
french.FinishedLabel=Ruruka est installé. Tu le retrouveras sur ton bureau et dans le menu Démarrer.
english.WelcomeLabel1=Welcome to Ruruka's case notebook!
english.WelcomeLabel2=Ruruka will be installed on your computer: your AniList list, your anime folders and mpv, together in a little magic notebook.%n%nClick Next to open the case.
english.FinishedHeadingLabel=Case solved!
english.FinishedLabel=Ruruka is installed. You'll find it on your desktop and in the Start menu.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Ruruka"; Filename: "{app}\Ruruka.exe"
Name: "{autodesktop}\Ruruka"; Filename: "{app}\Ruruka.exe"; Tasks: desktopicon

[Run]
; <-- Sans skipifsilent : après une mise à jour silencieuse lancée par l'app, Ruruka se relance tout seul -->
Filename: "{app}\Ruruka.exe"; Description: "{cm:LaunchProgram,Ruruka}"; Flags: nowait postinstall 
