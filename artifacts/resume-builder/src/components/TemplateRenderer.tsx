import { TEMPLATES, getTemplate } from './templates';
import { ResumeContent } from './templates/types';
import SingleColumn from './templates/layouts/SingleColumn';
import SidebarLeft from './templates/layouts/SidebarLeft';
import SidebarRight from './templates/layouts/SidebarRight';
import Banner from './templates/layouts/Banner';
import Compact from './templates/layouts/Compact';

interface Props {
  templateId: string;
  data: ResumeContent;
}

export default function TemplateRenderer({ templateId, data }: Props) {
  const config = getTemplate(templateId);
  const props = { data, theme: config.theme };
  switch (config.layout) {
    case 'sidebar-left': return <SidebarLeft {...props} />;
    case 'sidebar-right': return <SidebarRight {...props} />;
    case 'banner': return <Banner {...props} />;
    case 'compact': return <Compact {...props} />;
    default: return <SingleColumn {...props} />;
  }
}
