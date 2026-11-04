-- Categories currently published on qapchaconews.com. No demo articles: this data may reach production.
insert into public.categories (name, slug, color, sort_order) values
  ('Cooperativismo', 'cooperativismo', '#1a5313', 0),
  ('Medioambiente', 'medioambiente', '#267e40', 0),
  ('Nacionales', 'Nacionales', '#e54e34', 0),
  ('Entretenimiento', 'Entretenimiento', '#f88f16', 0),
  ('Tecnología', 'tecnologia', '#3d519e', 0),
  ('Chaco paraguayo', 'chaco-paraguayo', '#E33A2E', 0),
  ('Producción', 'producción', '#9a6c1d', 0),
  ('Actualidades', 'actualidades', '#9500b3', 0),
  ('Internacionales', 'internacionales', '#0e327c', 0),
  ('MERCOSUR', 'mercosur', '#0e7eaf', 0),
  ('Política', 'politica', '#bc1016', 1),
  ('Economía', 'economia', '#7787a6', 2),
  ('Sociedad', 'sociedad', '#bc7524', 3),
  ('Deportes', 'deportes', '#1D4ED8', 4),
  ('Cultura', 'cultura', '#7052a3', 5)
on conflict (slug) do nothing;
