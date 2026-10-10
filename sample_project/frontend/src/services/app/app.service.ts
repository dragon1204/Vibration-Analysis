import NiceModal from '@ebay/nice-modal-react';
import LoadingModal from '@/components/tree/loading-modal';

class AppService {
  showLoadingModal(props?: { fullScreen?: boolean }) {
    NiceModal.show(LoadingModal, {
      fullScreen: props?.fullScreen,
    });
  }

  hideLoadingModal() {
    NiceModal.hide(LoadingModal);
  }
}

const appService = new AppService();

export default appService;
