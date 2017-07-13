CREATE TABLE table2 (
    id integer NOT NULL,
    filepath character varying(300) NOT NULL,
    date timestamp without time zone,
    focallength double precision,
    aperture double precision,
    iso integer,
    lensmodel character varying(100),
    location character varying(200),
    cameramodel character varying(100),
    rating integer
);
create table cameramodels (id serial, model varchar(100));
-- Run after you've populated table2:
-- insert into cameramodels (model) select distinct cameramodel from table2;