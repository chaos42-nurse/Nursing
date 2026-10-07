# -*- coding: utf-8 -*-
"""
Traduzione in italiano del database interazioni (DrugBank / TDCommons).

Il dataset di origine (data/db_drug_interactions.csv.zip) e' in inglese.
Questo modulo e' l'UNICA fonte di verita' per:

  * i nomi dei principi attivi (inglese -> denominazione comune italiana);
  * le 86 frasi di interazione (inglese -> italiano);
  * la classificazione "pericolosa" / "possibile".

Viene usato da scripts/update_interactions.py per generare data/interazioni.csv
e per scrivere data/traduzioni-interazioni.json, che l'app legge nel browser
per tradurre al volo anche le righe dello ZIP originale.
"""

import re

# ---------------------------------------------------------------------------
# 1. NOMI DEI PRINCIPI ATTIVI
# ---------------------------------------------------------------------------

# Parole di sali, anioni, cationi e termini ricorrenti nei nomi composti.
PAROLE = {
    "acid": "acido", "hydrochloride": "cloridrato", "hydrobromide": "bromidrato",
    "chloride": "cloruro", "bromide": "bromuro", "iodide": "ioduro",
    "fluoride": "fluoruro", "sulfate": "solfato", "sulfite": "solfito",
    "sulfide": "solfuro", "phosphate": "fosfato", "nitrate": "nitrato",
    "nitrite": "nitrito", "carbonate": "carbonato", "bicarbonate": "bicarbonato",
    "hydroxide": "idrossido", "oxide": "ossido", "dioxide": "diossido",
    "trioxide": "triossido", "peroxide": "perossido", "acetate": "acetato",
    "diacetate": "diacetato", "citrate": "citrato", "subcitrate": "subcitrato",
    "lactate": "lattato", "gluconate": "gluconato", "mesylate": "mesilato",
    "maleate": "maleato", "fumarate": "fumarato", "tartrate": "tartrato",
    "succinate": "succinato", "besylate": "besilato", "tosylate": "tosilato",
    "hydrate": "idrato", "propionate": "propionato", "dipropionate": "dipropionato",
    "furoate": "furoato", "caproate": "capronato", "decanoate": "decanoato",
    "oleate": "oleato", "salicylate": "salicilato", "trisalicylate": "trisalicilato",
    "subsalicylate": "subsalicilato", "pyrophosphate": "pirofosfato",
    "glycerophosphate": "glicerofosfato", "polysulfate": "polisolfato",
    "sodium": "sodio", "potassium": "potassio", "dipotassium": "dipotassio",
    "calcium": "calcio", "magnesium": "magnesio", "aluminum": "alluminio",
    "aluminium": "alluminio", "lithium": "litio", "zinc": "zinco", "iron": "ferro",
    "ferric": "ferrico", "silver": "argento", "bismuth": "bismuto",
    "gallium": "gallio", "strontium": "stronzio", "lanthanum": "lantanio",
    "titanium": "titanio", "arsenic": "arsenico", "ammonium": "ammonio",
    "copper": "rame", "cation": "catione", "anhydrous": "anidro",
    "monobasic": "monobasico", "activated": "attivo", "charcoal": "carbone",
    "alcohol": "alcol", "blue": "blu", "methylene": "metilene",
    "benzyl": "benzile", "methyl": "metile", "ethyl": "etile",
    "dimethyl": "dimetil", "mustard": "mostarda", "sucrose": "saccarosio",
    "alum": "allume", "ovine": "ovina", "nitric": "nitrico", "nitrous": "nitroso",
    "vitamin": "vitamina", "and": "e",
}

# Terminazioni (ordine importante: la prima che corrisponde vince).
TERMINAZIONI = [
    ("oxide", "ossido"), ("sulfoxide", "solfossido"),
    ("flurane", "flurano"), ("ime", "ima"),
    ("ine", "ina"), ("ose", "osio"),
    ("ium", "io"), ("ole", "olo"), ("ol", "olo"),
    ("ate", "ato"), ("ite", "ito"), ("yl", "il"),
    ("setron", "setrone"), ("bupropion", "bupropione"), ("in", "ina"),
]

# Parole che NON devono ricevere la terminazione italiana.
NON_TERMINAZIONE = {
    "warfarin", "dabigatran", "gabapentin", "pregabalin", "doxazosin",
    "cefepime", "exemestane", "glatiramer", "teriparatide", "propofol",
}


def _maiuscola(testo):
    return testo[:1].upper() + testo[1:] if testo else testo


def _ortografia(w):
    """Adatta l'ortografia inglese a quella italiana (ph->f, th->t, y->i ...)."""
    w = re.sub(r"^h(?=[aeiouy])", "", w)           # haloperidol -> aloperidol
    w = w.replace("hydroxy", "idrossi").replace("hydro", "idro")
    w = w.replace("doxy", "doxi").replace("oxy", "ossi")
    w = w.replace("ph", "f").replace("th", "t")
    w = re.sub(r"ch(?=[lraou])", "c", w)           # chlor -> clor, cholic -> colic
    w = w.replace("y", "i")
    w = re.sub(r"^hi", "i", w)
    return w


def parola_it(w):
    """Traduce una singola parola (gia' in minuscolo)."""
    if w in PAROLE:
        return PAROLE[w]
    base = w
    if w in NON_TERMINAZIONE:
        return _ortografia(w)
    # aggettivi degli acidi: tranexamic -> tranexamico, nitrous -> nitroso
    if w.endswith("ic") and len(w) > 4:
        return _ortografia(w) + "o"
    if w.endswith("ous"):
        return _ortografia(w[:-3]) + "oso"
    if w.endswith(("gliptin", "gliflozin")):
        return _ortografia(w)
    if w.endswith("platin"):
        return _ortografia(w) + "o"                  # cisplatin -> cisplatino
    for fine, nuova in TERMINAZIONI:
        if w.endswith(fine) and len(w) > len(fine) + 1:
            return _ortografia(w[: -len(fine)]) + nuova
    if w.endswith(("en", "gliptin", "gliflozin")) and not w.endswith(("fen", "iden")):
        return _ortografia(w)                        # sitagliptin, aliskiren: invariati
    if w.endswith(("fen", "iden")):
        return _ortografia(w) + "e"                  # ibuprofen -> ibuprofene
    return _ortografia(base)


def _token_it(token):
    """Traduce un token mantenendo sigle, numeri e trattini."""
    if not token:
        return token
    if re.search(r"\d", token) or (token.isupper() and len(token) <= 3):
        return token
    if "-" in token:
        return "-".join(_token_it(p) for p in token.split("-"))
    return parola_it(token.lower())


# Eccezioni verificate a mano (chiave: nome inglese in minuscolo).
ECCEZIONI = {
    'acenocoumarol': 'Acenocumarolo',
    'acetaminophen': 'Paracetamolo',
    'acetohydroxamic acid': 'Acido acetoidrossamico',
    'acetyldigitoxin': 'Acetildigitossina',
    'activated charcoal': 'Carbone attivo',
    'aliskiren': 'Aliskiren',
    'alogliptin': 'Alogliptin',
    'alosetron': 'Alosetron',
    'aminohippuric acid': 'Acido amminoippurico',
    'amodiaquine': 'Amodiachina',
    'amyl nitrite': 'Amile nitrito',
    'anisotropine methylbromide': 'Anisotropina metilbromuro',
    'artemether': 'Artemetere',
    'benzoyl peroxide': 'Benzoile perossido',
    'benzyl alcohol': 'Alcol benzilico',
    'betahistine': 'Betaistina',
    'bethanechol': 'Betanecolo',
    'bisacodyl': 'Bisacodile',
    'bismuth subcitrate potassium': 'Bismuto subcitrato potassico',
    'bupropion': 'Bupropione',
    'butamben': 'Butamben',
    'canagliflozin': 'Canagliflozin',
    'carboplatin': 'Carboplatino',
    'cefditoren': 'Cefditoren',
    'ceftibuten': 'Ceftibuten',
    'chenodeoxycholic acid': 'Acido chenodesossicolico',
    'chloral hydrate': 'Cloralio idrato',
    'chlorambucil': 'Clorambucile',
    'chloroquine': 'Clorochina',
    'chloroxylenol': 'Cloroxilenolo',
    'chlorpheniramine': 'Clorfenamina',
    'chromium': 'Cromo',
    'cisplatin': 'Cisplatino',
    'cyproheptadine': 'Ciproeptadina',
    'dapagliflozin': 'Dapagliflozin',
    'debrisoquine': 'Debrisochina',
    'deoxycholic acid': 'Acido desossicolico',
    'desoximetasone': 'Desossimetasone',
    'dexamethasone': 'Desametasone',
    'dexrazoxane': 'Dexrazoxano',
    'dextroamphetamine': 'Destroamfetamina',
    'dextromethorphan': 'Destrometorfano',
    'dextropropoxyphene': 'Destropropossifene',
    'dicoumarol': 'Dicumarolo',
    'dicyclomine': 'Dicicloverina',
    'digitoxin': 'Digitossina',
    'digoxin': 'Digossina',
    'dimenhydrinate': 'Dimenidrinato',
    'dimethyl fumarate': 'Dimetilfumarato',
    'dimethyl sulfoxide': 'Dimetilsolfossido',
    'diphenhydramine': 'Difenidramina',
    'dolasetron': 'Dolasetron',
    'dotatate gallium ga-68': 'Gallio (68Ga) dotatate',
    'doxycycline': 'Doxiciclina',
    'doxylamine': 'Doxilamina',
    'epinephrine': 'Adrenalina',
    'erythrityl tetranitrate': 'Eritrile tetranitrato',
    'ethosuximide': 'Etosuccimide',
    'fluorouracil': 'Fluorouracile',
    'fospropofol': 'Fospropofol',
    'gamma-hydroxybutyric acid': 'Acido gamma-idrossibutirrico',
    'glyburide': 'Glibenclamide',
    'glycerin': 'Glicerolo',
    'glycerol phenylbutyrate': 'Glicerolo fenilbutirrato',
    'goserelin': 'Goserelin',
    'halothane': 'Alotano',
    'hexaminolevulinate': 'Esaminolevulinato',
    'hexetidine': 'Esetidina',
    'hexobarbital': 'Esobarbital',
    'hexoprenaline': 'Esoprenalina',
    'hexylresorcinol': 'Esilresorcinolo',
    'hydroxychloroquine': 'Idrossiclorochina',
    'hydroxyprogesterone caproate': 'Idrossiprogesterone capronato',
    'hydroxyurea': 'Idrossicarbamide',
    'isocarboxazid': 'Isocarbossazide',
    'isoniazid': 'Isoniazide',
    'isothipendyl': 'Isotipendile',
    'isoxsuprine': 'Isossisuprina',
    'kaolin': 'Caolino',
    'l-glutamine': 'L-glutammina',
    'lactic acid': 'Acido lattico',
    'lactulose': 'Lattulosio',
    'leucovorin': 'Calcio folinato',
    'levallorphan': 'Levallorfano',
    'levoleucovorin': 'Calcio levofolinato',
    'lithium cation': 'Litio',
    'magnesium cation': 'Magnesio',
    'mefloquine': 'Meflochina',
    'meperidine': 'Petidina',
    'methadyl acetate': 'Metadile acetato',
    'methimazole': 'Tiamazolo',
    'methohexital': 'Metoexitale',
    'methotrimeprazine': 'Levomepromazina',
    'methoxsalen': 'Metossalene',
    'methsuximide': 'Metsuccimide',
    'methylene blue': 'Blu di metilene',
    'mycophenolate mofetil': 'Micofenolato mofetile',
    'naproxen': 'Naprossene',
    'nitric oxide': 'Ossido nitrico',
    'nitrofural': 'Nitrofurazone',
    'nitroprusside': 'Nitroprussiato',
    'nitrous oxide': 'Protossido di azoto',
    'nonoxynol-9': 'Nonoxinol-9',
    'norepinephrine': 'Noradrenalina',
    'palonosetron': 'Palonosetron',
    'paraldehyde': 'Paraldeide',
    'paricalcitol': 'Paracalcitolo',
    'pentaerythritol tetranitrate': 'Pentaeritrile tetranitrato',
    'pentoxifylline': 'Pentossifillina',
    'perhexiline': 'Perexilina',
    'phenprocoumon': 'Fenprocumone',
    'phensuximide': 'Fensuccimide',
    'phenylbutyric acid': 'Acido fenilbutirrico',
    'phylloquinone': 'Fitomenadione',
    'picosulfuric acid': 'Acido picosolforico',
    'potassium cation': 'Potassio',
    'primaquine': 'Primachina',
    'propofol': 'Propofol',
    'propylthiouracil': 'Propiltiouracile',
    'protocatechualdehyde': 'Protocatecualdeide',
    'pyridoxine': 'Piridossina',
    'quinacrine': 'Chinacrina',
    'quinethazone': 'Chinetazone',
    'quinidine': 'Chinidina',
    'quinine': 'Chinino',
    'radium ra 223 dichloride': 'Radio (223Ra) dicloruro',
    'silver sulfadiazine': 'Sulfadiazina argentica',
    'sodium phosphate, monobasic': 'Sodio fosfato monobasico',
    'spironolactone': 'Spironolattone',
    'succinylcholine': 'Suxametonio',
    'sulfadimethoxine': 'Sulfadimetossina',
    'sulfadoxine': 'Sulfadossina',
    'sulfamethoxazole': 'Sulfametossazolo',
    'sulfamoxole': 'Sulfamossolo',
    'sulfisoxazole': 'Sulfisossazolo',
    'technetium tc-99m mebrofenin': 'Tecnezio (99mTc) mebrofenina',
    'technetium tc-99m medronate': 'Tecnezio (99mTc) medronato',
    'technetium tc-99m sestamibi': 'Tecnezio (99mTc) sestamibi',
    'thiosulfuric acid': 'Acido tiosolforico',
    'triethylenetetramine': 'Trientina',
    'trihexyphenidyl': 'Triesifenidile',
    'tropisetron': 'Tropisetron',
    'tryptophan': 'Triptofano',
    'uracil mustard': 'Uramustina',
    'ursodeoxycholic acid': 'Acido ursodesossicolico',
    'vigabatrin': 'Vigabatrin',
    'yohimbine': 'Yohimbina',
}


def nome_it(nome_en):
    """Nome inglese -> nome italiano del principio attivo."""
    chiave = nome_en.strip().lower()
    if chiave in ECCEZIONI:
        return ECCEZIONI[chiave]

    testo = nome_en.strip()
    # "X acid" -> "Acido X"
    parti = testo.split()
    if len(parti) >= 2 and parti[-1].lower() == "acid":
        aggettivo = " ".join(_token_it(p) for p in parti[:-1])
        return _maiuscola("acido " + aggettivo.lower())

    parole = [_token_it(p.lower() if p.lower() in PAROLE else p) for p in parti]
    risultato = " ".join(parole)
    # prima lettera maiuscola, il resto minuscolo, salvo sigle
    return _maiuscola(risultato)


# ---------------------------------------------------------------------------
# 2. FRASI DI INTERAZIONE (86 modelli) + CLASSIFICAZIONE
# ---------------------------------------------------------------------------
# Il dataset DrugBank/TDC NON contiene un campo di gravita'. La classificazione
# e' quindi dedotta dal TIPO di effetto descritto:
#   "pericolosa": effetto potenzialmente grave (aritmie/QT, depressione di SNC e
#                 respiro, emorragie, trombosi, ipoglicemia, squilibri elettrolitici
#                 gravi, sindrome serotoninergica, tossicita' d'organo, ecc.);
#   "possibile" : variazioni di concentrazione/metabolismo/efficacia o effetti
#                 da monitorare (ipotensione, rischio generico di effetti avversi...).
# Non sostituisce il giudizio clinico, l'RCP o il parere del farmacista.
P = "pericolosa"
M = "possibile"

EFFETTI = [
    ("The risk or severity of adverse effects can be increased when {A} is combined with {B}.",
     "Il rischio o la gravità degli effetti avversi può aumentare quando {A} e {B} vengono associati.", M),
    ("The metabolism of {B} can be decreased when combined with {A}.",
     "Il metabolismo di {B} può diminuire in associazione con {A}.", M),
    ("The serum concentration of {B} can be increased when it is combined with {A}.",
     "La concentrazione sierica di {B} può aumentare in associazione con {A}.", M),
    ("The serum concentration of {B} can be decreased when it is combined with {A}.",
     "La concentrazione sierica di {B} può diminuire in associazione con {A}.", M),
    ("{A} may increase the hypotensive activities of {B}.",
     "{A} può aumentare l'effetto ipotensivo di {B}.", M),
    ("The therapeutic efficacy of {B} can be decreased when used in combination with {A}.",
     "L'efficacia terapeutica di {B} può diminuire se usato in associazione con {A}.", M),
    ("{A} may increase the QTc-prolonging activities of {B}.",
     "{A} può aumentare l'effetto di prolungamento dell'intervallo QTc di {B}.", P),
    ("{A} may increase the central nervous system depressant (CNS depressant) activities of {B}.",
     "{A} può aumentare l'effetto depressivo sul sistema nervoso centrale (SNC) di {B}.", P),
    ("The metabolism of {B} can be increased when combined with {A}.",
     "Il metabolismo di {B} può aumentare in associazione con {A}.", M),
    ("{A} may increase the anticoagulant activities of {B}.",
     "{A} può aumentare l'effetto anticoagulante di {B}.", P),
    ("{A} may decrease the antihypertensive activities of {B}.",
     "{A} può ridurre l'effetto antipertensivo di {B}.", M),
    ("{A} may increase the hypoglycemic activities of {B}.",
     "{A} può aumentare l'effetto ipoglicemizzante di {B}.", P),
    ("{A} may decrease the excretion rate of {B} which could result in a higher serum level.",
     "{A} può ridurre la velocità di eliminazione di {B}, con possibile aumento dei livelli sierici.", M),
    ("{A} may increase the bradycardic activities of {B}.",
     "{A} può aumentare l'effetto bradicardizzante di {B}.", P),
    ("{A} may increase the hypokalemic activities of {B}.",
     "{A} può aumentare l'effetto ipokaliemizzante di {B}.", P),
    ("{A} may decrease the cardiotoxic activities of {B}.",
     "{A} può ridurre l'effetto cardiotossico di {B}.", M),
    ("{A} may increase the sedative activities of {B}.",
     "{A} può aumentare l'effetto sedativo di {B}.", M),
    ("{A} may increase the neuroexcitatory activities of {B}.",
     "{A} può aumentare l'effetto neuroeccitatorio di {B} (rischio di convulsioni).", P),
    ("{A} can cause a decrease in the absorption of {B} resulting in a reduced serum concentration and potentially a decrease in efficacy.",
     "{A} può ridurre l'assorbimento di {B}, con diminuzione della concentrazione sierica e possibile riduzione dell'efficacia.", M),
    ("{A} may increase the serotonergic activities of {B}.",
     "{A} può aumentare l'effetto serotoninergico di {B} (rischio di sindrome serotoninergica).", P),
    ("{A} may increase the atrioventricular blocking (AV block) activities of {B}.",
     "{A} può aumentare l'effetto di blocco atrioventricolare (blocco AV) di {B}.", P),
    ("{A} may increase the hypertensive activities of {B}.",
     "{A} può aumentare l'effetto ipertensivo di {B}.", M),
    ("{A} may increase the nephrotoxic activities of {B}.",
     "{A} può aumentare l'effetto nefrotossico di {B}.", P),
    ("{A} may increase the antihypertensive activities of {B}.",
     "{A} può aumentare l'effetto antipertensivo di {B}.", M),
    ("{A} may increase the orthostatic hypotensive activities of {B}.",
     "{A} può aumentare l'effetto ipotensivo ortostatico di {B}.", M),
    ("{A} may decrease the sedative activities of {B}.",
     "{A} può ridurre l'effetto sedativo di {B}.", M),
    ("The serum concentration of the active metabolites of {B} can be increased when {B} is used in combination with {A}.",
     "La concentrazione sierica dei metaboliti attivi di {B} può aumentare se {B} è usato in associazione con {A}.", M),
    ("The bioavailability of {B} can be decreased when combined with {A}.",
     "La biodisponibilità di {B} può diminuire in associazione con {A}.", M),
    ("{A} may decrease the stimulatory activities of {B}.",
     "{A} può ridurre l'effetto stimolante di {B}.", M),
    ("The risk or severity of QTc prolongation can be increased when {A} is combined with {B}.",
     "Il rischio o la gravità del prolungamento dell'intervallo QTc può aumentare quando {A} e {B} vengono associati.", P),
    ("{A} may increase the fluid retaining activities of {B}.",
     "{A} può aumentare l'effetto di ritenzione idrica di {B}.", M),
    ("{A} may increase the neuromuscular blocking activities of {B}.",
     "{A} può aumentare l'effetto di blocco neuromuscolare di {B}.", P),
    ("{A} may increase the tachycardic activities of {B}.",
     "{A} può aumentare l'effetto tachicardizzante di {B}.", M),
    ("{A} may decrease the bronchodilatory activities of {B}.",
     "{A} può ridurre l'effetto broncodilatatore di {B}.", M),
    ("{A} may increase the arrhythmogenic activities of {B}.",
     "{A} può aumentare l'effetto aritmogeno di {B}.", P),
    ("{A} may increase the antiplatelet activities of {B}.",
     "{A} può aumentare l'effetto antiaggregante piastrinico di {B} (rischio di sanguinamento).", P),
    ("{A} may decrease the diuretic activities of {B}.",
     "{A} può ridurre l'effetto diuretico di {B}.", M),
    ("{A} may increase the anticholinergic activities of {B}.",
     "{A} può aumentare l'effetto anticolinergico di {B}.", M),
    ("{A} may increase the immunosuppressive activities of {B}.",
     "{A} può aumentare l'effetto immunosoppressivo di {B}.", M),
    ("The serum concentration of the active metabolites of {B} can be reduced when {B} is used in combination with {A} resulting in a loss in efficacy.",
     "La concentrazione sierica dei metaboliti attivi di {B} può diminuire se {B} è usato in associazione con {A}, con perdita di efficacia.", M),
    ("{A} may decrease the vasoconstricting activities of {B}.",
     "{A} può ridurre l'effetto vasocostrittore di {B}.", M),
    ("{A} may increase the respiratory depressant activities of {B}.",
     "{A} può aumentare l'effetto depressivo sulla respirazione di {B}.", P),
    ("{A} may increase the analgesic activities of {B}.",
     "{A} può aumentare l'effetto analgesico di {B}.", M),
    ("{A} may increase the hyperkalemic activities of {B}.",
     "{A} può aumentare l'effetto iperkaliemizzante di {B}.", P),
    ("The therapeutic efficacy of {B} can be increased when used in combination with {A}.",
     "L'efficacia terapeutica di {B} può aumentare se usato in associazione con {A}.", M),
    ("{A} may decrease the anticoagulant activities of {B}.",
     "{A} può ridurre l'effetto anticoagulante di {B}.", M),
    ("{A} may increase the cardiotoxic activities of {B}.",
     "{A} può aumentare l'effetto cardiotossico di {B}.", P),
    ("{A} may increase the hypocalcemic activities of {B}.",
     "{A} può aumentare l'effetto ipocalcemizzante di {B}.", M),
    ("{A} may increase the constipating activities of {B}.",
     "{A} può aumentare l'effetto costipante di {B}.", M),
    ("The risk or severity of bleeding can be increased when {A} is combined with {B}.",
     "Il rischio o la gravità di sanguinamento può aumentare quando {A} e {B} vengono associati.", P),
    ("{A} may increase the hyponatremic activities of {B}.",
     "{A} può aumentare l'effetto iponatriemizzante di {B}.", P),
    ("{A} may increase the vasoconstricting activities of {B}.",
     "{A} può aumentare l'effetto vasocostrittore di {B}.", M),
    ("{A} may increase the thrombogenic activities of {B}.",
     "{A} può aumentare l'effetto trombogeno di {B} (rischio di trombosi).", P),
    ("{A} may increase the antipsychotic activities of {B}.",
     "{A} può aumentare l'effetto antipsicotico di {B}.", M),
    ("{A} may increase the adverse neuromuscular activities of {B}.",
     "{A} può aumentare gli effetti neuromuscolari avversi di {B}.", P),
    ("{A} may increase the hypercalcemic activities of {B}.",
     "{A} può aumentare l'effetto ipercalcemizzante di {B}.", M),
    ("{A} can cause an increase in the absorption of {B} resulting in an increased serum concentration and potentially a worsening of adverse effects.",
     "{A} può aumentare l'assorbimento di {B}, con aumento della concentrazione sierica e possibile peggioramento degli effetti avversi.", M),
    ("{A} may decrease the neuromuscular blocking activities of {B}.",
     "{A} può ridurre l'effetto di blocco neuromuscolare di {B}.", M),
    ("{A} may increase the neurotoxic activities of {B}.",
     "{A} può aumentare l'effetto neurotossico di {B}.", P),
    ("{A} may increase the myopathic rhabdomyolysis activities of {B}.",
     "{A} può aumentare l'effetto miopatico di {B} (rischio di rabdomiolisi).", P),
    ("{A} may increase the vasopressor activities of {B}.",
     "{A} può aumentare l'effetto vasopressore di {B}.", M),
    ("{A} may increase the hepatotoxic activities of {B}.",
     "{A} può aumentare l'effetto epatotossico di {B}.", P),
    ("{A} may increase the stimulatory activities of {B}.",
     "{A} può aumentare l'effetto stimolante di {B}.", M),
    ("The absorption of {B} can be decreased when combined with {A}.",
     "L'assorbimento di {B} può diminuire in associazione con {A}.", M),
    ("{A} may increase the ulcerogenic activities of {B}.",
     "{A} può aumentare l'effetto ulcerogeno di {B}.", M),
    ("{A} may increase the myelosuppressive activities of {B}.",
     "{A} può aumentare l'effetto mielosoppressivo di {B}.", P),
    ("{A} may decrease effectiveness of {B} as a diagnostic agent.",
     "{A} può ridurre l'efficacia di {B} come agente diagnostico.", M),
    ("{A} may increase the vasodilatory activities of {B}.",
     "{A} può aumentare l'effetto vasodilatatore di {B}.", M),
    ("The risk or severity of hypotension can be increased when {A} is combined with {B}.",
     "Il rischio o la gravità di ipotensione può aumentare quando {A} e {B} vengono associati.", M),
    ("{A} may increase the excretion rate of {B} which could result in a lower serum level and potentially a reduction in efficacy.",
     "{A} può aumentare la velocità di eliminazione di {B}, con possibile riduzione dei livelli sierici e dell'efficacia.", M),
    ("{A} may increase the hyperglycemic activities of {B}.",
     "{A} può aumentare l'effetto iperglicemizzante di {B}.", M),
    ("The risk of a hypersensitivity reaction to {B} is increased when it is combined with {A}.",
     "Il rischio di reazione di ipersensibilità a {B} aumenta in associazione con {A}.", P),
    ("{A} may increase the central nervous system depressant (CNS depressant) and hypertensive activities of {B}.",
     "{A} può aumentare l'effetto depressivo sul sistema nervoso centrale (SNC) e ipertensivo di {B}.", P),
    ("The risk or severity of heart failure can be increased when {B} is combined with {A}.",
     "Il rischio o la gravità di insufficienza cardiaca può aumentare quando {B} e {A} vengono associati.", P),
    ("{A} may increase the bronchoconstrictory activities of {B}.",
     "{A} può aumentare l'effetto broncocostrittore di {B}.", M),
    ("{A} may increase the ototoxic activities of {B}.",
     "{A} può aumentare l'effetto ototossico di {B}.", P),
    ("The risk or severity of hypertension can be increased when {B} is combined with {A}.",
     "Il rischio o la gravità di ipertensione può aumentare quando {B} e {A} vengono associati.", M),
    ("{A} may increase the hypotensive and central nervous system depressant (CNS depressant) activities of {B}.",
     "{A} può aumentare l'effetto ipotensivo e depressivo sul sistema nervoso centrale (SNC) di {B}.", P),
    ("{A} may increase the central neurotoxic activities of {B}.",
     "{A} può aumentare l'effetto neurotossico centrale di {B}.", P),
    ("{A} may increase the photosensitizing activities of {B}.",
     "{A} può aumentare l'effetto fotosensibilizzante di {B}.", M),
    ("{A} may increase the dermatologic adverse activities of {B}.",
     "{A} può aumentare gli effetti avversi dermatologici di {B}.", M),
    ("The protein binding of {B} can be decreased when combined with {A}.",
     "Il legame proteico di {B} può diminuire in associazione con {A}.", M),
    ("The bioavailability of {B} can be increased when combined with {A}.",
     "La biodisponibilità di {B} può aumentare in associazione con {A}.", M),
    ("{A} may decrease the analgesic activities of {B}.",
     "{A} può ridurre l'effetto analgesico di {B}.", M),
    ("{A} may decrease the antiplatelet activities of {B}.",
     "{A} può ridurre l'effetto antiaggregante piastrinico di {B}.", M),
    ("The risk or severity of hyperkalemia can be increased when {A} is combined with {B}.",
     "Il rischio o la gravità di iperkaliemia può aumentare quando {A} e {B} vengono associati.", P),
]

TEMPLATE_EN = {en: (it, g) for en, it, g in EFFETTI}


def modello_da_testo(testo, a, b):
    """Sostituisce i nomi dei due farmaci con {A}/{B} (prima il nome piu' lungo)."""
    sostituzioni = sorted([(a, "{A}"), (b, "{B}")], key=lambda x: -len(x[0]))
    for nome, segnaposto in sostituzioni:
        testo = testo.replace(nome, segnaposto)
    return testo


def effetto_it(testo_en, a_en, b_en):
    """Ritorna (testo italiano, gravita') oppure None se il modello non e' noto."""
    modello = modello_da_testo(testo_en, a_en, b_en)
    trovato = TEMPLATE_EN.get(modello)
    if not trovato:
        return None
    it, g = trovato
    return it.replace("{A}", nome_it(a_en)).replace("{B}", nome_it(b_en)), g


def esporta_json(nomi_en=()):
    """Dizionario per il browser: nomi EN->IT e modelli di frase."""
    return {
        "versione": 1,
        "nomi": {n.lower(): nome_it(n) for n in sorted(set(nomi_en))},
        "nota": "Traduzione automatica dei nomi e degli effetti; classificazione "
                "pericolosa/possibile dedotta dal tipo di effetto, non dalla gravità clinica.",
        "effetti": [{"en": en, "it": it, "g": g} for en, it, g in EFFETTI],
    }
