# Bildsystemet :: en bilddatabas som kan hitta bilder tagna på fredagar
## ...och lite till

Välkommen till mitt livslånga projekt som aldrig blir färdigt! Här används inte best-practice kod och snabba lösningar är överallt. Tack för kiken!


Tanken med projektet är att man ska kunna ha ett bra alternativ till andra bildsystem.

## ::Dependencies::

PostgreSQL
NodeJS

## ::Installation::

    git clone https://github.com/MrYakobo/bildsystemet
    cd bildsystemet
    npm install -g

Lägg in din databasinformation i `setup/info.sample.json`, och döp om filen till `info.json`.

---

Indexering:

    node index

Kolla på bilderna:

    cd /path/to/images
    bildsystemet